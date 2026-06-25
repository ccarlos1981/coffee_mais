-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 3 (PRODUCTION HARDENING)
-- MIGRATION: CRIAÇÃO DA CAMADA DE LOGS E OBSERVABILIDADE DE APIS
-- =========================================================================

-- 1. Criar a tabela de logs de telemetria de APIs
CREATE TABLE IF NOT EXISTS public.cm_system_api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INT NOT NULL,
    response_time_ms INT NOT NULL,
    promotor_id UUID, -- UUID do colaborador (não-FK estrito para evitar locks em cascata)
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comentários das tabelas para documentação interna
COMMENT ON TABLE public.cm_system_api_logs IS 'Logs e métricas de observabilidade de rotas de API do Módulo Promotor.';
COMMENT ON COLUMN public.cm_system_api_logs.response_time_ms IS 'Tempo total de execução do servidor em milissegundos.';

-- 2. Índices de performance
CREATE INDEX IF NOT EXISTS idx_cm_api_logs_route_created ON public.cm_system_api_logs (route, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_api_logs_status ON public.cm_system_api_logs (status_code);
CREATE INDEX IF NOT EXISTS idx_cm_api_logs_promotor ON public.cm_system_api_logs (promotor_id);

-- 3. Habilitar RLS de leitura restrito a supervisores e gestores
ALTER TABLE public.cm_system_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_system_api_logs ON public.cm_system_api_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.cm_user_profiles
            WHERE cm_user_profiles.id = auth.uid()
            AND cm_user_profiles.role IN ('CEO', 'Admin', 'Trade', 'Supervisor')
        )
    );

-- 4. Política de Retenção de Dados: 30 dias para logs de API
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'purge-old-system-api-logs',
    '0 2 * * *', -- Todo dia às 02:00 AM
    $$DELETE FROM public.cm_system_api_logs WHERE created_at < now() - INTERVAL '30 days'$$
);
