-- Migration: Sprint 5.3 Sell-Out Intelligence & Inventory Prediction
-- Description: Create tables for sell-out analysis and alerts with proper indexing and security policies.

-- 1. Sell-Out Analysis Table
CREATE TABLE IF NOT EXISTS public.cm_sellout_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdv_id TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    estimated_stock_boxes NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    sellout_velocity NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    days_of_inventory NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    stock_risk VARCHAR(30) NOT NULL CHECK (stock_risk IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    slow_mover BOOLEAN DEFAULT false NOT NULL,
    dead_stock BOOLEAN DEFAULT false NOT NULL,
    suggested_order_boxes NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pdv_sku_sellout UNIQUE(pdv_id, sku)
);

-- Enable RLS & Policies
ALTER TABLE public.cm_sellout_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_sellout_analysis ON public.cm_sellout_analysis;
CREATE POLICY select_sellout_analysis ON public.cm_sellout_analysis FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_sellout_analysis ON public.cm_sellout_analysis;
CREATE POLICY manage_sellout_analysis ON public.cm_sellout_analysis FOR ALL TO authenticated USING (true);

-- 2. Sell-Out Alerts Table
CREATE TABLE IF NOT EXISTS public.cm_sellout_alert (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdv_id TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('RUPTURE_RISK', 'SLOW_MOVER', 'DEAD_STOCK', 'OVERSTOCK')),
    description TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_sellout_alert ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_sellout_alert ON public.cm_sellout_alert;
CREATE POLICY select_sellout_alert ON public.cm_sellout_alert FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_sellout_alert ON public.cm_sellout_alert;
CREATE POLICY manage_sellout_alert ON public.cm_sellout_alert FOR ALL TO authenticated USING (true);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cm_sellout_analysis_pdv_id_sku ON public.cm_sellout_analysis(pdv_id, sku);
CREATE INDEX IF NOT EXISTS idx_cm_sellout_alert_pdv_id ON public.cm_sellout_alert(pdv_id);
CREATE INDEX IF NOT EXISTS idx_cm_sellout_alert_created_at ON public.cm_sellout_alert(created_at DESC);
