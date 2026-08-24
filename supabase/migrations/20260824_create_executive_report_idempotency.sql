-- ============================================================================
-- MIGRATION: 20260824_create_executive_report_idempotency.sql
-- DESCRIÇÃO: Tabela e RPCs atômicas para garantia de idempotência e rastreabilidade
--            do Relatório Executivo Diário Coffee++ em ambiente Serverless.
-- ============================================================================

-- 1. Criação da tabela de controle e auditoria de execuções
CREATE TABLE IF NOT EXISTS public.cm_executive_report_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    execution_id UUID NOT NULL,
    total_emails_expected INT NOT NULL DEFAULT 7,
    total_emails_sent INT NOT NULL DEFAULT 0,
    total_emails_failed INT NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cm_executive_report_logs_date UNIQUE (report_date)
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_cm_executive_report_logs_date ON public.cm_executive_report_logs(report_date);
CREATE INDEX IF NOT EXISTS idx_cm_executive_report_logs_status ON public.cm_executive_report_logs(status);

-- 2. Habilitação de RLS com permissão de leitura/escrita para service_role
ALTER TABLE public.cm_executive_report_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cm_executive_report_logs' 
          AND policyname = 'Allow service_role full access to executive report logs'
    ) THEN
        CREATE POLICY "Allow service_role full access to executive report logs"
            ON public.cm_executive_report_logs
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'cm_executive_report_logs' 
          AND policyname = 'Allow authenticated read access to executive report logs'
    ) THEN
        CREATE POLICY "Allow authenticated read access to executive report logs"
            ON public.cm_executive_report_logs
            FOR SELECT
            TO authenticated
            USING (true);
    END IF;
END $$;

-- 3. Função RPC Atômica para Aquisição de Lock de Execução
CREATE OR REPLACE FUNCTION public.fn_acquire_executive_report_lock(
    p_report_date DATE,
    p_execution_id UUID,
    p_force BOOLEAN DEFAULT FALSE,
    p_lock_timeout_minutes INT DEFAULT 15
)
RETURNS TABLE(
    acquired BOOLEAN,
    reason VARCHAR,
    current_status VARCHAR,
    started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_row public.cm_executive_report_logs%ROWTYPE;
BEGIN
    -- Caso 1: Forçar reexecução explícita (force=true)
    IF p_force THEN
        INSERT INTO public.cm_executive_report_logs (
            report_date, status, started_at, execution_id, total_emails_expected, total_emails_sent, total_emails_failed, details, updated_at
        ) VALUES (
            p_report_date, 'RUNNING', now(), p_execution_id, 7, 0, 0, '[]'::jsonb, now()
        )
        ON CONFLICT (report_date) DO UPDATE SET
            status = 'RUNNING',
            started_at = now(),
            completed_at = NULL,
            execution_id = p_execution_id,
            total_emails_sent = 0,
            total_emails_failed = 0,
            error_message = NULL,
            details = '[]'::jsonb,
            updated_at = now();

        RETURN QUERY SELECT TRUE, 'FORCE_ACQUIRED'::VARCHAR, 'RUNNING'::VARCHAR, now();
        RETURN;
    END IF;

    -- Caso 2: Tentativa atômica de inserção primária (INSERT ... ON CONFLICT DO NOTHING)
    INSERT INTO public.cm_executive_report_logs (
        report_date, status, started_at, execution_id, total_emails_expected, total_emails_sent, total_emails_failed, details, updated_at
    ) VALUES (
        p_report_date, 'RUNNING', now(), p_execution_id, 7, 0, 0, '[]'::jsonb, now()
    )
    ON CONFLICT (report_date) DO NOTHING;

    -- Se inseriu com sucesso nesta transação, lock adquirido
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'LOCK_ACQUIRED'::VARCHAR, 'RUNNING'::VARCHAR, now();
        RETURN;
    END IF;

    -- Caso 3: Registro já existia -> Avalia com lock exclusivo de linha (FOR UPDATE)
    SELECT * INTO v_row
    FROM public.cm_executive_report_logs
    WHERE report_date = p_report_date
    FOR UPDATE;

    -- 3.1 Se já completou com sucesso: NÃO executar novamente
    IF v_row.status = 'SUCCESS' THEN
        RETURN QUERY SELECT FALSE, 'SKIPPED_ALREADY_SENT'::VARCHAR, v_row.status, v_row.started_at;
        RETURN;
    END IF;

    -- 3.2 Se está RUNNING e ainda dentro do timeout de 15 minutos: Lock ocupado (outra requisição em andamento)
    IF v_row.status = 'RUNNING' AND v_row.started_at > (now() - (p_lock_timeout_minutes || ' minutes')::interval) THEN
        RETURN QUERY SELECT FALSE, 'SKIPPED_ALREADY_RUNNING'::VARCHAR, v_row.status, v_row.started_at;
        RETURN;
    END IF;

    -- 3.3 Se está FAILED ou RUNNING expirado (> 15 minutos sem conclusão): Recuperação / Retry seguro
    UPDATE public.cm_executive_report_logs
    SET status = 'RUNNING',
        started_at = now(),
        completed_at = NULL,
        execution_id = p_execution_id,
        total_emails_sent = 0,
        total_emails_failed = 0,
        error_message = NULL,
        details = '[]'::jsonb,
        updated_at = now()
    WHERE report_date = p_report_date;

    RETURN QUERY SELECT TRUE, 'RECOVERY_ACQUIRED'::VARCHAR, 'RUNNING'::VARCHAR, now();
    RETURN;
END;
$$;

-- 4. Função RPC para Finalização da Execução
CREATE OR REPLACE FUNCTION public.fn_complete_executive_report_log(
    p_report_date DATE,
    p_execution_id UUID,
    p_status VARCHAR,
    p_total_sent INT,
    p_total_failed INT,
    p_details JSONB,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cm_executive_report_logs
    SET status = p_status,
        completed_at = now(),
        total_emails_sent = p_total_sent,
        total_emails_failed = p_total_failed,
        details = p_details,
        error_message = p_error_message,
        updated_at = now()
    WHERE report_date = p_report_date
      AND execution_id = p_execution_id;
END;
$$;
