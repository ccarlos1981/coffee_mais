-- Migration: Sprint 5.2.5 Master Data, Route Intelligence & Commercial Context
-- Description: Create tables for visit SLA rules, expected visit frequency rules, operational route profiles, import audits, alter base_atendimento, and add performance indexes.

-- 1. Alter public.base_atendimento to include new master data fields
ALTER TABLE public.base_atendimento ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.base_atendimento ADD COLUMN IF NOT EXISTS faturamento_mensal NUMERIC(15,2) DEFAULT 0.00;
ALTER TABLE public.base_atendimento ADD COLUMN IF NOT EXISTS cluster_canal TEXT;

-- 2. Visit SLA Rules Table
CREATE TABLE IF NOT EXISTS public.cm_visit_sla_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faturamento_min NUMERIC(15,2) NOT NULL,
    faturamento_max NUMERIC(15,2) NOT NULL,
    base_visit_minutes INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_faturamento_range CHECK (faturamento_min <= faturamento_max)
);

-- Enable RLS & Policies
ALTER TABLE public.cm_visit_sla_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_visit_sla_rules ON public.cm_visit_sla_rules;
CREATE POLICY select_visit_sla_rules ON public.cm_visit_sla_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_visit_sla_rules ON public.cm_visit_sla_rules;
CREATE POLICY manage_visit_sla_rules ON public.cm_visit_sla_rules FOR ALL TO authenticated USING (true);

-- 3. Expected Visit Frequency Rules Table
CREATE TABLE IF NOT EXISTS public.cm_visit_frequency_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_canal VARCHAR(50) UNIQUE NOT NULL,
    expected_visits_per_month INT NOT NULL CHECK (expected_visits_per_month >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_visit_frequency_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_visit_freq_rules ON public.cm_visit_frequency_rules;
CREATE POLICY select_visit_freq_rules ON public.cm_visit_frequency_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_visit_freq_rules ON public.cm_visit_frequency_rules;
CREATE POLICY manage_visit_freq_rules ON public.cm_visit_frequency_rules FOR ALL TO authenticated USING (true);

-- 4. PDV Route Profile Table
CREATE TABLE IF NOT EXISTS public.cm_pdv_route_profile (
    pdv_id TEXT PRIMARY KEY REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    requires_fifo BOOLEAN DEFAULT false NOT NULL,
    requires_ai_photo BOOLEAN DEFAULT true NOT NULL,
    requires_price_ocr BOOLEAN DEFAULT true NOT NULL,
    requires_tasting BOOLEAN DEFAULT false NOT NULL,
    requires_rupture_detail BOOLEAN DEFAULT false NOT NULL,
    complexity_factor NUMERIC(5,2) DEFAULT 1.00 NOT NULL CHECK (complexity_factor >= 0.1 AND complexity_factor <= 10.0),
    commercial_visit_priority_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL CHECK (commercial_visit_priority_score >= 0.0 AND commercial_visit_priority_score <= 100.0),
    commercial_visit_priority_class VARCHAR(15) DEFAULT 'BAIXO' NOT NULL CHECK (commercial_visit_priority_class IN ('CRÍTICO', 'ALTO', 'MÉDIO', 'BAIXO')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_pdv_route_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_pdv_route_profile ON public.cm_pdv_route_profile;
CREATE POLICY select_pdv_route_profile ON public.cm_pdv_route_profile FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_pdv_route_profile ON public.cm_pdv_route_profile;
CREATE POLICY manage_pdv_route_profile ON public.cm_pdv_route_profile FOR ALL TO authenticated USING (true);

-- 5. PDV Import Job Audit Table
CREATE TABLE IF NOT EXISTS public.cm_pdv_import_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_rows INT DEFAULT 0 NOT NULL,
    valid_rows INT DEFAULT 0 NOT NULL,
    invalid_rows INT DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'PROCESSING' NOT NULL CHECK (status IN ('PROCESSING', 'SUCCESS', 'FAILED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_pdv_import_job ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_pdv_import_job ON public.cm_pdv_import_job;
CREATE POLICY select_pdv_import_job ON public.cm_pdv_import_job FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_pdv_import_job ON public.cm_pdv_import_job;
CREATE POLICY manage_pdv_import_job ON public.cm_pdv_import_job FOR ALL TO authenticated USING (true);

-- 6. Performance Indexes on Underlying Sales Tables
CREATE INDEX IF NOT EXISTS idx_sales_v2_cod_parceiro ON public.sales_v2(cod_parceiro);
CREATE INDEX IF NOT EXISTS idx_sales_v2_invoice_date ON public.sales_v2(invoice_date);
CREATE INDEX IF NOT EXISTS idx_faturamento_sankhya_cod_parceiro ON public.cm_faturamento_sankhya(cod_parceiro);
CREATE INDEX IF NOT EXISTS idx_faturamento_sankhya_dt_faturamento ON public.cm_faturamento_sankhya(dt_faturamento);

-- 7. Seed Visit SLA Rules
INSERT INTO public.cm_visit_sla_rules (faturamento_min, faturamento_max, base_visit_minutes)
VALUES
  (0.00, 20000.00, 15),
  (20000.01, 50000.00, 25),
  (50000.01, 100000.00, 40),
  (100000.01, 300000.00, 60),
  (300000.01, 999999999.99, 90)
ON CONFLICT DO NOTHING;

-- 8. Seed Visit Frequency Rules
INSERT INTO public.cm_visit_frequency_rules (cluster_canal, expected_visits_per_month)
VALUES
  ('A', 8),
  ('B', 4),
  ('C', 2),
  ('D', 1)
ON CONFLICT (cluster_canal) DO UPDATE
SET expected_visits_per_month = EXCLUDED.expected_visits_per_month;
