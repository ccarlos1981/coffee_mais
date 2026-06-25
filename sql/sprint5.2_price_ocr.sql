-- Migration: Sprint 5.2 Price OCR & Price Intelligence
-- Description: Create tables for competitor catalogs, pricing strategy references, price analysis results, and commercial alerts.

-- 1. Competitor Reference Catalog
CREATE TABLE IF NOT EXISTS public.cm_competitor_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_name TEXT NOT NULL,
    sku VARCHAR(100) UNIQUE NOT NULL,
    product_name TEXT,
    package_size TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_competitor_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_competitor_ref ON public.cm_competitor_reference;
CREATE POLICY select_competitor_ref ON public.cm_competitor_reference FOR SELECT TO authenticated USING (true);

-- 2. Strategic Price Reference (Coffee Mais)
CREATE TABLE IF NOT EXISTS public.cm_price_reference (
    sku VARCHAR(100) PRIMARY KEY REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    suggested_min_price NUMERIC(10,2) NOT NULL,
    suggested_target_price NUMERIC(10,2) NOT NULL,
    suggested_max_price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_price_reference ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_price_ref ON public.cm_price_reference;
CREATE POLICY select_price_ref ON public.cm_price_reference FOR SELECT TO authenticated USING (true);

-- 3. AI Price Analysis Table
CREATE TABLE IF NOT EXISTS public.cm_ai_price_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    analysis_id UUID REFERENCES public.cm_ai_shelf_analysis(id) ON DELETE CASCADE,
    ocr_status VARCHAR(20) DEFAULT 'PENDING' CHECK (ocr_status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED')),
    detected_prices JSONB DEFAULT '[]'::jsonb,
    price_index NUMERIC(10,2),
    price_gap_percent NUMERIC(10,2),
    pricing_risk VARCHAR(30) CHECK (pricing_risk IN ('COMPETITIVE', 'SLIGHTLY_EXPENSIVE', 'OVERPRICED', 'UNDERPRICED')),
    sku_gap_analysis JSONB DEFAULT '{}'::jsonb,
    price_opportunity_score NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_price_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manage_ai_price_analysis ON public.cm_ai_price_analysis;
CREATE POLICY manage_ai_price_analysis ON public.cm_ai_price_analysis FOR ALL TO authenticated USING (true);

-- 4. AI Price Analysis Normalised Items
CREATE TABLE IF NOT EXISTS public.cm_ai_price_analysis_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_analysis_id UUID REFERENCES public.cm_ai_price_analysis(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    confidence FLOAT NOT NULL,
    is_promo BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_price_analysis_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manage_ai_price_analysis_item ON public.cm_ai_price_analysis_item;
CREATE POLICY manage_ai_price_analysis_item ON public.cm_ai_price_analysis_item FOR ALL TO authenticated USING (true);

-- 5. AI Pricing Alerts Table
CREATE TABLE IF NOT EXISTS public.cm_ai_pricing_alert (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visita_id UUID REFERENCES public.cm_promotor_visita(id) ON DELETE CASCADE,
    pdv_id TEXT REFERENCES public.base_atendimento(cod_parceiro) ON DELETE CASCADE,
    sku VARCHAR(100) REFERENCES public.cm_ai_product_reference(sku) ON DELETE CASCADE,
    tipo_alerta VARCHAR(50) CHECK (tipo_alerta IN ('overpriced_versus_market', 'overpriced_versus_strategy', 'competitor_promo_detected')),
    descricao TEXT NOT NULL,
    is_resolvido BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE public.cm_ai_pricing_alert ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manage_ai_pricing_alert ON public.cm_ai_pricing_alert;
CREATE POLICY manage_ai_pricing_alert ON public.cm_ai_pricing_alert FOR ALL TO authenticated USING (true);

-- 6. Seeds for Competitor References
INSERT INTO public.cm_competitor_reference (brand_name, sku, product_name, package_size)
VALUES
  ('Pilão', 'PILAO_250G', 'Café Pilão Tradicional 250g', '250g'),
  ('3 Corações', 'TRES_CORACOES_250G', 'Café 3 Corações Tradicional 250g', '250g'),
  ('Melitta', 'MELITTA_250G', 'Café Melitta Tradicional 250g', '250g'),
  ('Santa Clara', 'SANTA_CLARA_250G', 'Café Santa Clara Vácuo 250g', '250g'),
  ('L''Or', 'LOR_250G', 'Café L''Or Classique Moído 250g', '250g')
ON CONFLICT (sku) DO NOTHING;

-- 7. Seeds for Strategic Price Reference (Coffee Mais)
INSERT INTO public.cm_price_reference (sku, suggested_min_price, suggested_target_price, suggested_max_price)
VALUES
  ('COFFEE_MAIS_CLASSICO', 20.90, 23.90, 26.90),
  ('COFFEE_MAIS_INTENSO', 21.90, 24.90, 27.90),
  ('COFFEE_MAIS_GOURMET', 22.90, 25.90, 28.90),
  ('COFFEE_MAIS_ESPRESSO', 79.90, 84.90, 89.90)
ON CONFLICT (sku) DO NOTHING;
