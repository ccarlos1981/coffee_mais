-- Migration: Sprint 6.3 KPI Configuration & AI Governance
-- Description: Alter KPI master catalog & company config, create governance policies, decision logs, configuration versions, and configure multi-tenant RLS.

-- 1. Alter cm_kpi_definition catalog table
ALTER TABLE public.cm_kpi_definition ADD COLUMN IF NOT EXISTS kpi_code VARCHAR(100) UNIQUE;
ALTER TABLE public.cm_kpi_definition ADD COLUMN IF NOT EXISTS kpi_name TEXT;
ALTER TABLE public.cm_kpi_definition ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.cm_kpi_definition ADD COLUMN IF NOT EXISTS default_weight NUMERIC(5,2) DEFAULT 0.00;
ALTER TABLE public.cm_kpi_definition ADD COLUMN IF NOT EXISTS default_enabled BOOLEAN DEFAULT true;

-- Migrate existing catalog columns
UPDATE public.cm_kpi_definition SET kpi_code = kpi_key WHERE kpi_code IS NULL;
UPDATE public.cm_kpi_definition SET kpi_name = display_name WHERE kpi_name IS NULL;

-- Enforce constraints
ALTER TABLE public.cm_kpi_definition ALTER COLUMN kpi_code SET NOT NULL;
ALTER TABLE public.cm_kpi_definition ALTER COLUMN kpi_name SET NOT NULL;

-- 2. Alter cm_company_kpi_config table
ALTER TABLE public.cm_company_kpi_config ADD COLUMN IF NOT EXISTS kpi_code VARCHAR(100) REFERENCES public.cm_kpi_definition(kpi_code) ON DELETE CASCADE;
ALTER TABLE public.cm_company_kpi_config ADD COLUMN IF NOT EXISTS threshold_low NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.cm_company_kpi_config ADD COLUMN IF NOT EXISTS threshold_medium NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.cm_company_kpi_config ADD COLUMN IF NOT EXISTS threshold_high NUMERIC(10,2) DEFAULT 0.00;
ALTER TABLE public.cm_company_kpi_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate existing config relationship mapping
UPDATE public.cm_company_kpi_config c
SET kpi_code = k.kpi_code
FROM public.cm_kpi_definition k
WHERE c.kpi_id = k.id AND c.kpi_code IS NULL;

-- Migrate threshold mappings
UPDATE public.cm_company_kpi_config
SET threshold_low = 0.00,
    threshold_medium = warning_threshold,
    threshold_high = critical_threshold
WHERE threshold_medium IS NULL OR threshold_medium = 0.00;

-- Apply constraints
ALTER TABLE public.cm_company_kpi_config DROP CONSTRAINT IF EXISTS unique_company_kpi_code;
ALTER TABLE public.cm_company_kpi_config ADD CONSTRAINT unique_company_kpi_code UNIQUE (company_id, kpi_code);

-- 3. Alter cm_ai_recommendation for approval workflow
ALTER TABLE public.cm_ai_recommendation ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE public.cm_ai_recommendation ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE public.cm_ai_recommendation ADD COLUMN IF NOT EXISTS governance_badge VARCHAR(30);
ALTER TABLE public.cm_ai_recommendation ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- 4. Create cm_ai_governance_policy table
CREATE TABLE IF NOT EXISTS public.cm_ai_governance_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    policy_key VARCHAR(100) NOT NULL,
    policy_value JSONB DEFAULT '{}'::jsonb NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_company_policy UNIQUE(company_id, policy_key)
);

-- Enable RLS & Policies for cm_ai_governance_policy
ALTER TABLE public.cm_ai_governance_policy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_policy ON public.cm_ai_governance_policy;
CREATE POLICY select_policy ON public.cm_ai_governance_policy 
    FOR SELECT TO authenticated 
    USING (company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS manage_policy ON public.cm_ai_governance_policy;
CREATE POLICY manage_policy ON public.cm_ai_governance_policy 
    FOR ALL TO authenticated 
    USING (
        company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()) 
        AND (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN ('Admin', 'Supervisor', 'CEO')
    );

-- 5. Create cm_ai_decision_log table
CREATE TABLE IF NOT EXISTS public.cm_ai_decision_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL,
    input_payload JSONB DEFAULT '{}'::jsonb,
    decision_payload JSONB DEFAULT '{}'::jsonb,
    model_confidence NUMERIC(5,2),
    approved_by_human BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_ai_decision_log
ALTER TABLE public.cm_ai_decision_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_decision_log ON public.cm_ai_decision_log;
CREATE POLICY select_decision_log ON public.cm_ai_decision_log 
    FOR SELECT TO authenticated 
    USING (company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS manage_decision_log ON public.cm_ai_decision_log;
CREATE POLICY manage_decision_log ON public.cm_ai_decision_log 
    FOR ALL TO authenticated 
    USING (
        company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()) 
        AND (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN ('Admin', 'Supervisor', 'CEO')
    );

-- 6. Create cm_kpi_config_version table
CREATE TABLE IF NOT EXISTS public.cm_kpi_config_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    version INT NOT NULL,
    config_snapshot JSONB NOT NULL,
    created_by UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_kpi_config_version
ALTER TABLE public.cm_kpi_config_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_kpi_config_version ON public.cm_kpi_config_version;
CREATE POLICY select_kpi_config_version ON public.cm_kpi_config_version 
    FOR SELECT TO authenticated 
    USING (company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS manage_kpi_config_version ON public.cm_kpi_config_version;
CREATE POLICY manage_kpi_config_version ON public.cm_kpi_config_version 
    FOR ALL TO authenticated 
    USING (
        company_id = (SELECT company_id FROM public.cm_user_profiles WHERE id = auth.uid()) 
        AND (SELECT role FROM public.cm_user_profiles WHERE id = auth.uid()) IN ('Admin', 'Supervisor', 'CEO')
    );

-- 7. Update cm_ai_model_alert type constraint
ALTER TABLE public.cm_ai_model_alert DROP CONSTRAINT IF EXISTS cm_ai_model_alert_alert_type_check;
ALTER TABLE public.cm_ai_model_alert ADD CONSTRAINT cm_ai_model_alert_alert_type_check 
    CHECK (alert_type IN ('CONFIDENCE_DROP', 'HIGH_PREDICTION_ERROR', 'ROI_DRIFT', 'WEIGHT_INSTABILITY', 'AUTONOMOUS_ACTION_SPIKE', 'EXCESSIVE_PRICE_CHANGE', 'OVERRIDE_RATE_HIGH', 'MODEL_DRIFT'));

-- 8. Seed Initial Data
-- ROI KPI Definition
INSERT INTO public.cm_kpi_definition (id, kpi_key, display_name, kpi_code, kpi_name, category, default_weight, default_enabled)
VALUES ('77777777-7777-7777-7777-777777777777', 'ROI', 'Retorno sobre Investimento (ROI)', 'ROI', 'Retorno sobre Investimento (ROI)', 'Financeiro', 20.00, true)
ON CONFLICT (kpi_code) DO NOTHING;

-- Seed Default KPI Config (Coffee Mais)
INSERT INTO public.cm_company_kpi_config (company_id, kpi_id, kpi_code, weight, target_value, warning_threshold, critical_threshold, threshold_low, threshold_medium, threshold_high, is_enabled)
VALUES (
    'e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 
    '77777777-7777-7777-7777-777777777777', 
    'ROI', 
    20.00, 
    2.50, 
    1.50, 
    0.50, 
    0.50, 
    1.50, 
    2.50, 
    true
)
ON CONFLICT (company_id, kpi_code) DO NOTHING;

-- Seed default weights for existing definitions
UPDATE public.cm_kpi_definition SET default_weight = 40.00, default_enabled = true WHERE kpi_code = 'rupture_rate';
UPDATE public.cm_kpi_definition SET default_weight = 30.00, default_enabled = true WHERE kpi_code = 'price_gap';
UPDATE public.cm_kpi_definition SET default_weight = 30.00, default_enabled = true WHERE kpi_code = 'share_of_shelf';
UPDATE public.cm_kpi_definition SET default_weight = 0.00, default_enabled = false WHERE kpi_code IN ('sellout_velocity', 'coverage_rate', 'conversion_rate');

-- Default Governance Policies (Coffee Mais)
INSERT INTO public.cm_ai_governance_policy (company_id, policy_key, policy_value)
VALUES 
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'ai_autonomy_level', '"SEMI_AUTONOMOUS"'),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'min_confidence_to_act', '80'),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'require_human_approval', 'true'),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'max_discount_allowed', '15'),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'emergency_ai_stop', 'false'),
    ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'max_kpi_weight_shift', '5')
ON CONFLICT (company_id, policy_key) DO NOTHING;
