-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 3 (COMMAND CENTER OPERACIONAL)
-- SCRIPT DE MIGRAÇÃO: LIVE STATUS, TRACKING, ALERTAS E REGRAS DE RETENÇÃO
-- =========================================================================

-- 1. Coluna de foto da fachada no check-in
ALTER TABLE public.cm_promotor_visita 
ADD COLUMN IF NOT EXISTS checkin_foto_fachada_url TEXT;

-- 2. Tabela de Estado Live do Promotor
CREATE TABLE IF NOT EXISTS public.cm_promotor_live_status (
    promotor_id UUID PRIMARY KEY REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN (
        'DISPONIVEL', 
        'EM_ROTA', 
        'EM_LOJA_CHECKIN', 
        'EM_EXECUCAO', 
        'EM_OCORRENCIA',
        'CHECKOUT_PENDENTE', 
        'JORNADA_ENCERRADA'
    )),
    current_visita_id UUID REFERENCES public.cm_promotor_visita(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_m DOUBLE PRECISION,
    bateria_percent INT CHECK (bateria_percent BETWEEN 0 AND 100),
    bateria_charging BOOLEAN,
    tipo_conexao TEXT,
    last_heartbeat TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Logs de Trajeto (Tracking)
CREATE TABLE IF NOT EXISTS public.cm_promotor_heartbeat_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_m DOUBLE PRECISION,
    bateria_percent INT,
    bateria_charging BOOLEAN,
    tipo_conexao TEXT,
    source_event TEXT NOT NULL CHECK (source_event IN (
        'HEARTBEAT_PERIODICO', 
        'CHECKIN', 
        'CHECKOUT', 
        'FOTO_UPLOAD', 
        'DESLOCAMENTO_INICIADO', 
        'OCORRENCIA'
    )), 
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabela de Alertas Operacionais
CREATE TABLE IF NOT EXISTS public.cm_promotor_alerta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID NOT NULL REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    visita_id UUID REFERENCES public.cm_promotor_visita(id) ON DELETE SET NULL,
    tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN (
        'BATERIA_CRITICA', 
        'SEM_HEARTBEAT', 
        'TEMPO_EXCESSIVO_LOJA', 
        'DESVIO_ROTA', 
        'VELOCIDADE_IMPOSSIVEL'
    )),
    descricao TEXT NOT NULL,
    is_resolvido BOOLEAN DEFAULT false NOT NULL,
    resolvido_at TIMESTAMPTZ,
    resolvido_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.cm_promotor_live_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_heartbeat_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_alerta ENABLE ROW LEVEL SECURITY;

-- Políticas de Select/Insert/Update para Live Status
CREATE POLICY "Promotores leem seu proprio status live" ON public.cm_promotor_live_status FOR SELECT TO authenticated USING (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);
CREATE POLICY "Gestores leem status live global" ON public.cm_promotor_live_status FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);
CREATE POLICY "Promotores inserem seu proprio status live" ON public.cm_promotor_live_status FOR INSERT TO authenticated WITH CHECK (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);
CREATE POLICY "Promotores atualizam seu proprio status live" ON public.cm_promotor_live_status FOR UPDATE TO authenticated USING (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);

-- Políticas para Heartbeat Log
CREATE POLICY "Promotores leem seus proprios logs" ON public.cm_promotor_heartbeat_log FOR SELECT TO authenticated USING (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);
CREATE POLICY "Gestores leem logs de tracking" ON public.cm_promotor_heartbeat_log FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);
CREATE POLICY "Promotores inserem seus logs" ON public.cm_promotor_heartbeat_log FOR INSERT TO authenticated WITH CHECK (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);

-- Políticas para Alertas
CREATE POLICY "Promotores leem seus proprios alertas" ON public.cm_promotor_alerta FOR SELECT TO authenticated USING (
    promotor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
);
CREATE POLICY "Gestores leem alertas" ON public.cm_promotor_alerta FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);
CREATE POLICY "Gestores atualizam alertas" ON public.cm_promotor_alerta FOR UPDATE TO authenticated USING (
    auth.uid() IN (SELECT id FROM public.cm_user_profiles WHERE role IN ('CEO', 'Admin', 'Trade', 'Supervisor'))
);

-- Índices de Otimização e Deduplicação
CREATE INDEX IF NOT EXISTS idx_heartbeat_promotor_created ON public.cm_promotor_heartbeat_log(promotor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerta_promotor_resolvido ON public.cm_promotor_alerta(promotor_id, is_resolvido);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unq_alerta_promotor_tipo_ativo ON public.cm_promotor_alerta(promotor_id, tipo_alerta) WHERE (is_resolvido = false);

-- Agendamento pg_cron de limpeza diária (retendo 90 dias de logs históricos)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'limpar-logs-tracking-antigos',
            '0 3 * * *',
            'DELETE FROM public.cm_promotor_heartbeat_log WHERE created_at < now() - INTERVAL ''90 days'''
        );
    END IF;
END $$;
