-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 3 (PRODUCTION HARDENING)
-- MIGRATION: CRIAÇÃO DA TABELA DE FEATURE FLAGS
-- =========================================================================

-- 1. Criar a tabela de feature flags
CREATE TABLE IF NOT EXISTS public.cm_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key VARCHAR(50) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT false NOT NULL,
    active_regions VARCHAR(50)[] DEFAULT '{}'::VARCHAR(50)[] NOT NULL,
    active_supervisor_ids UUID[] DEFAULT '{}'::UUID[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.cm_feature_flags IS 'Tabela de controle de ativação gradual de funcionalidades (Feature Flags) por região ou supervisor.';

-- 2. Habilitar RLS
ALTER TABLE public.cm_feature_flags ENABLE ROW LEVEL SECURITY;

-- Evitar duplicação da policy caso o script rode múltiplas vezes
DROP POLICY IF EXISTS select_feature_flags ON public.cm_feature_flags;

CREATE POLICY select_feature_flags ON public.cm_feature_flags
    FOR SELECT
    USING (true);

-- 3. Inserir flag padrão do Módulo Promotor desativada por padrão
INSERT INTO public.cm_feature_flags (flag_key, is_active, active_regions, active_supervisor_ids)
VALUES ('modulo_promotor_command_center', false, '{}'::VARCHAR(50)[], '{}'::UUID[])
ON CONFLICT (flag_key) DO NOTHING;
