-- Migration: 20260719161607_fase3_sprint3.1_infra.sql
-- Description: Infraestrutura de tabelas, RLS e helpers para qualidade cadastral da Fase 3

BEGIN;

-- 1. Criar a Função Centralizada de Autorização de Governança
CREATE OR REPLACE FUNCTION public.is_governance_admin(p_user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.cm_user_profiles
        WHERE id = p_user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Tabela de Configurações de Governança
CREATE TABLE IF NOT EXISTS public.cm_governance_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.cm_user_profiles(id)
);

-- 3. Tabela de Snapshots Históricos
CREATE TABLE IF NOT EXISTS public.cm_cadastros_qualidade_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    total_clientes INTEGER NOT NULL,
    sem_responsavel INTEGER NOT NULL,
    sem_uf INTEGER NOT NULL,
    sem_matriz INTEGER NOT NULL,
    total_inconsistencias INTEGER NOT NULL,
    iqc_score NUMERIC(5,2) NOT NULL,
    cobertura_score NUMERIC(5,2) NOT NULL,
    baseline_version TEXT NOT NULL DEFAULT 'v1.0.1',
    audit_rules_version TEXT NOT NULL DEFAULT 'v1.0.0',
    execution_source TEXT NOT NULL CHECK (execution_source IN ('cron', 'post_import', 'manual')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Histórico de Evolução do Schema da Governança (Metadata)
CREATE TABLE IF NOT EXISTS public.cm_governance_schema_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    baseline_version TEXT NOT NULL,
    fase TEXT NOT NULL,
    sprint TEXT NOT NULL,
    migration_name TEXT NOT NULL,
    executed_by UUID REFERENCES public.cm_user_profiles(id)
);

-- 5. Habilitar RLS nas tabelas
ALTER TABLE public.cm_governance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_cadastros_qualidade_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_governance_schema_history ENABLE ROW LEVEL SECURITY;

-- 6. Configurar Políticas RLS Utilizando a Função Centralizada
-- 6.1. Configurações de Governança
CREATE POLICY select_settings ON public.cm_governance_settings 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_settings ON public.cm_governance_settings 
    FOR ALL TO authenticated USING (public.is_governance_admin(auth.uid()));

-- 6.2. Snapshots Históricos
CREATE POLICY select_snapshots ON public.cm_cadastros_qualidade_snapshots 
    FOR SELECT TO authenticated USING (true);

-- 6.3. Histórico de Schema (Metadados)
CREATE POLICY select_history ON public.cm_governance_schema_history 
    FOR SELECT TO authenticated USING (true);

-- 7. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_quality_snapshots_date ON public.cm_cadastros_qualidade_snapshots (snapshot_date DESC);

-- 8. Função de Validação de UFs Brasileiras (Desacoplada)
CREATE OR REPLACE FUNCTION public.check_cliente_uf_validity(p_uf TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_uf IN (
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Registrar o Metadado da Execução desta Migration
INSERT INTO public.cm_governance_schema_history (baseline_version, fase, sprint, migration_name)
VALUES ('v1.0.1', 'Fase 3', 'Sprint 3.1', '20260719161607_fase3_sprint3.1_infra.sql');

COMMIT;
