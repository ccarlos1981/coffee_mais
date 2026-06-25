-- Migration: Sprint 5.4 Order Recommendation Engine & Assisted Sell-In
-- Description: Create tables for suggested orders and recommended items with RLS policies, index optimizations, and expand catalog tables.

-- 1. Expand public.cm_ai_product_reference with pack and price details
ALTER TABLE public.cm_ai_product_reference ADD COLUMN IF NOT EXISTS case_pack INT DEFAULT 1;
ALTER TABLE public.cm_ai_product_reference ADD COLUMN IF NOT EXISTS minimum_order INT DEFAULT 1;
ALTER TABLE public.cm_ai_product_reference ADD COLUMN IF NOT EXISTS sell_price_reference NUMERIC(10,2);

-- Update seed pricing and packaging reference for Coffee Mais SKUs
UPDATE public.cm_ai_product_reference SET case_pack = 6, minimum_order = 6, sell_price_reference = 60.00 WHERE sku = 'COFFEE_MAIS_CLASSICO';
UPDATE public.cm_ai_product_reference SET case_pack = 6, minimum_order = 6, sell_price_reference = 60.00 WHERE sku = 'COFFEE_MAIS_INTENSO';
UPDATE public.cm_ai_product_reference SET case_pack = 6, minimum_order = 6, sell_price_reference = 65.00 WHERE sku = 'COFFEE_MAIS_GOURMET';
UPDATE public.cm_ai_product_reference SET case_pack = 6, minimum_order = 6, sell_price_reference = 70.00 WHERE sku = 'COFFEE_MAIS_ESPRESSO';

-- Fallback defaults for remaining items
UPDATE public.cm_ai_product_reference SET case_pack = 6, minimum_order = 6, sell_price_reference = 55.00 WHERE case_pack IS NULL;

-- 2. Consolidate Order Recommendation Table
CREATE TABLE IF NOT EXISTS public.cm_order_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID NOT NULL REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    pdv_id TEXT NOT NULL REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    total_recommended_value NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
    total_recommended_boxes NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    urgency_level VARCHAR(20) NOT NULL CHECK (urgency_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    conversion_probability NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_visita_recommendation UNIQUE(visita_id)
);

-- Enable RLS & Policies
ALTER TABLE public.cm_order_recommendation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_order_recommendation ON public.cm_order_recommendation;
CREATE POLICY select_order_recommendation ON public.cm_order_recommendation FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_order_recommendation ON public.cm_order_recommendation;
CREATE POLICY manage_order_recommendation ON public.cm_order_recommendation FOR ALL TO authenticated USING (true);

-- 3. SKU Suggested Item Details Table
CREATE TABLE IF NOT EXISTS public.cm_order_recommendation_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES public.cm_order_recommendation(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    suggested_boxes NUMERIC(12,2) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    reason JSONB DEFAULT '[]'::jsonb,
    priority_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL
);

-- Enable RLS & Policies
ALTER TABLE public.cm_order_recommendation_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_order_recommendation_item ON public.cm_order_recommendation_item;
CREATE POLICY select_order_recommendation_item ON public.cm_order_recommendation_item FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_order_recommendation_item ON public.cm_order_recommendation_item;
CREATE POLICY manage_order_recommendation_item ON public.cm_order_recommendation_item FOR ALL TO authenticated USING (true);

-- 4. Optimisation Indexes
CREATE INDEX IF NOT EXISTS idx_cm_order_rec_visita ON public.cm_order_recommendation(visita_id);
CREATE INDEX IF NOT EXISTS idx_cm_order_rec_pdv ON public.cm_order_recommendation(pdv_id);
CREATE INDEX IF NOT EXISTS idx_cm_order_rec_item_rec ON public.cm_order_recommendation_item(recommendation_id);
