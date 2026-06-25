-- Migration: Sprint 6.0 Configurable KPI Engine & AI Native Foundation
-- Description: Create tables for companies, KPI definitions, company-specific KPI weights/thresholds, and dynamic dashboard widget configurations.

-- 1. Create Company Table
CREATE TABLE IF NOT EXISTS public.cm_company (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name TEXT NOT NULL,
    industry_segment TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_company
ALTER TABLE public.cm_company ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_company ON public.cm_company;
CREATE POLICY select_company ON public.cm_company FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_company ON public.cm_company;
CREATE POLICY manage_company ON public.cm_company FOR ALL TO authenticated USING (true);

-- 2. Expand User Profiles and PDV tables to support Company mapping (Multi-Tenancy)
ALTER TABLE public.cm_user_profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.cm_company(id) ON DELETE SET NULL;
ALTER TABLE public.base_atendimento ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.cm_company(id) ON DELETE SET NULL;

-- 3. Create KPI Definition Table
CREATE TABLE IF NOT EXISTS public.cm_kpi_definition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_key VARCHAR(100) UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_kpi_definition
ALTER TABLE public.cm_kpi_definition ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_kpi_definition ON public.cm_kpi_definition;
CREATE POLICY select_kpi_definition ON public.cm_kpi_definition FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_kpi_definition ON public.cm_kpi_definition;
CREATE POLICY manage_kpi_definition ON public.cm_kpi_definition FOR ALL TO authenticated USING (true);

-- 4. Create Company KPI Config Table
CREATE TABLE IF NOT EXISTS public.cm_company_kpi_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    kpi_id UUID NOT NULL REFERENCES public.cm_kpi_definition(id) ON DELETE CASCADE,
    weight NUMERIC(5,2) DEFAULT 1.00 NOT NULL,
    target_value NUMERIC(15,2) NOT NULL,
    warning_threshold NUMERIC(15,2) NOT NULL,
    critical_threshold NUMERIC(15,2) NOT NULL,
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_company_kpi UNIQUE(company_id, kpi_id)
);

-- Enable RLS & Policies for cm_company_kpi_config
ALTER TABLE public.cm_company_kpi_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_company_kpi_config ON public.cm_company_kpi_config;
CREATE POLICY select_company_kpi_config ON public.cm_company_kpi_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_company_kpi_config ON public.cm_company_kpi_config;
CREATE POLICY manage_company_kpi_config ON public.cm_company_kpi_config FOR ALL TO authenticated USING (true);

-- 5. Create Dashboard Widget Config Table
CREATE TABLE IF NOT EXISTS public.cm_dashboard_widget_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    widget_key VARCHAR(50) NOT NULL,
    widget_order INT DEFAULT 0 NOT NULL,
    is_enabled BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_company_widget UNIQUE(company_id, widget_key)
);

-- Enable RLS & Policies for cm_dashboard_widget_config
ALTER TABLE public.cm_dashboard_widget_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_dashboard_widget_config ON public.cm_dashboard_widget_config;
CREATE POLICY select_dashboard_widget_config ON public.cm_dashboard_widget_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_dashboard_widget_config ON public.cm_dashboard_widget_config;
CREATE POLICY manage_dashboard_widget_config ON public.cm_dashboard_widget_config FOR ALL TO authenticated USING (true);

-- 6. Performance Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_cm_kpi_def_key ON public.cm_kpi_definition(kpi_key);
CREATE INDEX IF NOT EXISTS idx_cm_company_kpi_comp ON public.cm_company_kpi_config(company_id);
CREATE INDEX IF NOT EXISTS idx_cm_dash_widget_comp ON public.cm_dashboard_widget_config(company_id);

-- 7. Seed Initial Data
-- 7.1. Seed Default Company (Coffee Mais)
INSERT INTO public.cm_company (id, company_name, industry_segment)
VALUES ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'Coffee Mais', 'Bebidas e Cafés Especiais')
ON CONFLICT (id) DO NOTHING;

-- Map existing user profiles to Default Company
UPDATE public.cm_user_profiles
SET company_id = 'e143e8d6-c7d7-4315-8f54-aa12ce554d2d'
WHERE company_id IS NULL;

-- 7.2. Seed Global KPI Definitions
INSERT INTO public.cm_kpi_definition (id, kpi_key, display_name, category)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'rupture_rate', 'Taxa de Ruptura', 'Estoque'),
    ('22222222-2222-2222-2222-222222222222', 'price_gap', 'Preço Competitivo', 'Preço'),
    ('33333333-3333-3333-3333-333333333333', 'sellout_velocity', 'Giro de Vendas (Sell-Out)', 'Vendas'),
    ('44444444-4444-4444-4444-444444444444', 'coverage_rate', 'Cobertura de Visitas', 'Rotas'),
    ('55555555-5555-5555-5555-555555555555', 'share_of_shelf', 'Participação de Gôndola', 'Exibição'),
    ('66666666-6666-6666-6666-666666666666', 'conversion_rate', 'Taxa de Conversão de Pedidos', 'Vendas')
ON CONFLICT (kpi_key) DO NOTHING;

-- 7.3. Seed Company KPI Configurations (Coffee Mais default)
INSERT INTO public.cm_company_kpi_config (company_id, kpi_id, weight, target_value, warning_threshold, critical_threshold, is_enabled)
VALUES
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '11111111-1111-1111-1111-111111111111', 40.00, 0.05, 0.15, 0.25, true),  -- rupture_rate (lower is better, target 5%, warning 15%, critical 25%)
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '22222222-2222-2222-2222-222222222222', 30.00, 0.02, 0.08, 0.15, true),  -- price_gap (lower is better, target 2%, warning 8%, critical 15%)
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '33333333-3333-3333-3333-333333333333', 0.00, 10.00, 5.00, 2.00, false), -- sellout_velocity (higher is better, target 10 boxes/day)
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '44444444-4444-4444-4444-444444444444', 0.00, 0.90, 0.75, 0.60, false), -- coverage_rate (higher is better, target 90%)
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '55555555-5555-5555-5555-555555555555', 30.00, 0.50, 0.35, 0.20, true),  -- share_of_shelf (higher is better, target 50%, warning 35%, critical 20%)
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', '66666666-6666-6666-6666-666666666666', 0.00, 0.80, 0.60, 0.40, false)  -- conversion_rate (higher is better, target 80%)
ON CONFLICT (company_id, kpi_id) DO NOTHING;

-- 7.4. Seed Dashboard Widget Configs (Default tabs in order)
INSERT INTO public.cm_dashboard_widget_config (company_id, widget_key, widget_order, is_enabled)
VALUES
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'operacional', 1, true),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'investigativa', 2, true),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'executiva', 3, true),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'ai_vision', 4, true),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'route_intelligence', 5, true)
ON CONFLICT (company_id, widget_key) DO NOTHING;

-- 7.5. Seed AI Provider Feature Flag
INSERT INTO public.cm_feature_flags (flag_key, is_active)
VALUES ('use_real_ai', false)
ON CONFLICT (flag_key) DO NOTHING;
