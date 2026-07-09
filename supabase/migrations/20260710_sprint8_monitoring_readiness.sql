-- Migration para Sprint 8: Tabelas e Funções de Governança Operacional e Monitoramento

BEGIN;

-- 1. Criar a tabela de snapshots diários de governança
CREATE TABLE IF NOT EXISTS public.cm_investimentos_daily_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date DATE DEFAULT CURRENT_DATE UNIQUE,
    campanhas_criadas INT DEFAULT 0,
    campanhas_encerradas INT DEFAULT 0,
    campanhas_orfas INT DEFAULT 0,
    acoes_orfas INT DEFAULT 0,
    divergencias_financeiras INT DEFAULT 0,
    divergencias_operacionais INT DEFAULT 0,
    erros_codigo_campanha INT DEFAULT 0,
    falhas_upload_evidencias INT DEFAULT 0,
    falhas_notificacoes INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS e permitir acesso total de leitura a usuários autenticados
ALTER TABLE public.cm_investimentos_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users full read access" ON public.cm_investimentos_daily_snapshots;
CREATE POLICY "Allow all authenticated users full read access" 
ON public.cm_investimentos_daily_snapshots 
TO authenticated 
USING (true);

-- 3. Criar a função para gerar ou atualizar o snapshot do dia
CREATE OR REPLACE FUNCTION public.generate_investimentos_daily_snapshot()
RETURNS public.cm_investimentos_daily_snapshots AS $$
DECLARE
    v_campanhas_criadas INT;
    v_campanhas_encerradas INT;
    v_campanhas_orfas INT;
    v_acoes_orfas INT;
    v_divergencias_financeiras INT;
    v_divergencias_operacionais INT;
    v_erros_codigo_campanha INT;
    v_falhas_upload_evidencias INT;
    v_falhas_notificacoes INT;
    v_result public.cm_investimentos_daily_snapshots;
BEGIN
    -- A. Campanhas criadas hoje
    SELECT COUNT(*)::INT INTO v_campanhas_criadas
    FROM public.cm_campanhas
    WHERE created_at::date = CURRENT_DATE;

    -- B. Campanhas encerradas hoje
    SELECT COUNT(*)::INT INTO v_campanhas_encerradas
    FROM public.cm_campanhas
    WHERE status_operacional = 'CONCLUIDA' AND updated_at::date = CURRENT_DATE;

    -- C. Campanhas órfãs (sem ações)
    SELECT COUNT(*)::INT INTO v_campanhas_orfas
    FROM public.cm_campanhas c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cm_acoes_investimento a WHERE a.campanha_id = c.id
    );

    -- D. Ações órfãs (sem campanha)
    SELECT COUNT(*)::INT INTO v_acoes_orfas
    FROM public.cm_acoes_investimento
    WHERE campanha_id IS NULL;

    -- E. Divergências financeiras (ações quitadas com saldo diferente de zero)
    SELECT COUNT(*)::INT INTO v_divergencias_financeiras
    FROM public.cm_acoes_investimento a
    WHERE (a.fase_atual = 6 OR a.status_financeiro = 'QUITADA')
      AND ABS(COALESCE(a.apuracao_valor_realizado, 0) - public.get_acao_valor_total(a)) > 0.01;

    -- F. Divergências operacionais (campanha quitada com ações ainda nas fases iniciais 1 ou 2)
    SELECT COUNT(DISTINCT c.id)::INT INTO v_divergencias_operacionais
    FROM public.cm_campanhas c
    JOIN public.cm_acoes_investimento a ON a.campanha_id = c.id
    WHERE c.status_financeiro = 'QUITADA' AND a.fase_atual IN (1, 2);

    -- G. Erros de código amigável registrados hoje em cm_audit_logs
    SELECT COUNT(*)::INT INTO v_erros_codigo_campanha
    FROM public.cm_audit_logs
    WHERE (new_data->>'event_type' = 'FRIENDLY_CODE_ERROR' OR action = 'FRIENDLY_CODE_ERROR')
      AND created_at::date = CURRENT_DATE;

    -- H. Falhas de upload de evidências hoje em cm_audit_logs
    SELECT COUNT(*)::INT INTO v_falhas_upload_evidencias
    FROM public.cm_audit_logs
    WHERE (new_data->>'event_type' = 'EVIDENCE_UPLOAD_ERROR' OR action = 'EVIDENCE_UPLOAD_ERROR')
      AND created_at::date = CURRENT_DATE;

    -- I. Falhas de notificações registradas hoje
    SELECT COUNT(*)::INT INTO v_falhas_notificacoes
    FROM public.cm_audit_logs
    WHERE (new_data->>'event_type' = 'EMAIL_SEND_ERROR' OR action = 'EMAIL_SEND_ERROR')
      AND created_at::date = CURRENT_DATE;

    -- Inserir ou atualizar o registro de hoje
    INSERT INTO public.cm_investimentos_daily_snapshots (
        snapshot_date,
        campanhas_criadas,
        campanhas_encerradas,
        campanhas_orfas,
        acoes_orfas,
        divergencias_financeiras,
        divergencias_operacionais,
        erros_codigo_campanha,
        falhas_upload_evidencias,
        falhas_notificacoes,
        created_at
    )
    VALUES (
        CURRENT_DATE,
        v_campanhas_criadas,
        v_campanhas_encerradas,
        v_campanhas_orfas,
        v_acoes_orfas,
        v_divergencias_financeiras,
        v_divergencias_operacionais,
        v_erros_codigo_campanha,
        v_falhas_upload_evidencias,
        v_falhas_notificacoes,
        timezone('utc'::text, now())
    )
    ON CONFLICT (snapshot_date) 
    DO UPDATE SET
        campanhas_criadas = EXCLUDED.campanhas_criadas,
        campanhas_encerradas = EXCLUDED.campanhas_encerradas,
        campanhas_orfas = EXCLUDED.campanhas_orfas,
        acoes_orfas = EXCLUDED.acoes_orfas,
        divergencias_financeiras = EXCLUDED.divergencias_financeiras,
        divergencias_operacionais = EXCLUDED.divergencias_operacionais,
        erros_codigo_campanha = EXCLUDED.erros_codigo_campanha,
        falhas_upload_evidencias = EXCLUDED.falhas_upload_evidencias,
        falhas_notificacoes = EXCLUDED.falhas_notificacoes,
        created_at = timezone('utc'::text, now())
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMIT;
