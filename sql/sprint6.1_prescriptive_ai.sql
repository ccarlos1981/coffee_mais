-- Migration: Sprint 6.1 Prescriptive AI & Trade Recommendation Engine
-- Description: Create tables for AI recommendations and action simulations, setup RLS, indexes, and register new dynamic widget.

-- 1. Create AI Recommendation Table
CREATE TABLE IF NOT EXISTS public.cm_ai_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN ('PDV', 'SKU', 'REGION', 'DISTRIBUTOR')),
    entity_id TEXT NOT NULL,
    recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN ('PRICE_REDUCTION', 'PRICE_INCREASE', 'TRADE_PROMOTION', 'EXTRA_VISIT', 'DEGUSTATION', 'DISPLAY_EXPANSION', 'STOCK_REPLENISHMENT', 'DISTRIBUTOR_REPLENISHMENT', 'NEGOTIATE_SPACE')),
    priority_score NUMERIC(5,2) NOT NULL,
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    expected_sellout_uplift_percent NUMERIC(10,2) NOT NULL,
    expected_revenue_uplift NUMERIC(15,2) NOT NULL,
    expected_margin_uplift NUMERIC(15,2) NOT NULL,
    estimated_cost NUMERIC(15,2) NOT NULL,
    estimated_roi NUMERIC(10,2) NOT NULL,
    recommendation_confidence NUMERIC(5,2) DEFAULT 100.00 NOT NULL,
    reasoning JSONB DEFAULT '[]'::jsonb,
    recommended_action JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) DEFAULT 'OPEN' NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'EXECUTED', 'DISMISSED')),
    assigned_user_id UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    executed_by UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ,
    execution_feedback JSONB DEFAULT '{}'::jsonb,
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_ai_recommendation
ALTER TABLE public.cm_ai_recommendation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_ai_recommendation ON public.cm_ai_recommendation;
CREATE POLICY select_ai_recommendation ON public.cm_ai_recommendation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_ai_recommendation ON public.cm_ai_recommendation;
CREATE POLICY manage_ai_recommendation ON public.cm_ai_recommendation FOR ALL TO authenticated USING (true);

-- 2. Create Trade Action Simulation Table
CREATE TABLE IF NOT EXISTS public.cm_trade_action_simulation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID REFERENCES public.cm_ai_recommendation(id) ON DELETE CASCADE,
    action_payload JSONB NOT NULL,
    baseline_sellout NUMERIC(15,2) NOT NULL,
    simulated_sellout NUMERIC(15,2) NOT NULL,
    sellout_uplift_percent NUMERIC(10,2) NOT NULL,
    estimated_revenue NUMERIC(15,2) NOT NULL,
    estimated_margin NUMERIC(15,2) NOT NULL,
    estimated_cost NUMERIC(15,2) NOT NULL,
    estimated_roi NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies for cm_trade_action_simulation
ALTER TABLE public.cm_trade_action_simulation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_trade_action_simulation ON public.cm_trade_action_simulation;
CREATE POLICY select_trade_action_simulation ON public.cm_trade_action_simulation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_trade_action_simulation ON public.cm_trade_action_simulation;
CREATE POLICY manage_trade_action_simulation ON public.cm_trade_action_simulation FOR ALL TO authenticated USING (true);

-- 3. Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_cm_ai_rec_entity ON public.cm_ai_recommendation(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cm_ai_rec_status ON public.cm_ai_recommendation(status);
CREATE INDEX IF NOT EXISTS idx_cm_ai_rec_company ON public.cm_ai_recommendation(company_id);
CREATE INDEX IF NOT EXISTS idx_cm_trade_sim_rec ON public.cm_trade_action_simulation(recommendation_id);

-- 4. Register Prescriptive AI widget for Coffee Mais
INSERT INTO public.cm_dashboard_widget_config (company_id, widget_key, widget_order, is_enabled)
VALUES ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'prescriptive_ai', 6, true)
ON CONFLICT (company_id, widget_key) DO UPDATE SET is_enabled = true;
