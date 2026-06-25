-- Migration: Sprint 5.2 Price OCR Refinements & Final Adjustments
-- Description: Expand tables with raw OCR data, digit confidence tracking, strategic snapshots, market segments, and new alerts.

-- 1. Expand cm_ai_price_analysis_item
ALTER TABLE public.cm_ai_price_analysis_item ADD COLUMN IF NOT EXISTS ocr_text_raw TEXT;
ALTER TABLE public.cm_ai_price_analysis_item ADD COLUMN IF NOT EXISTS price_bbox JSONB;
ALTER TABLE public.cm_ai_price_analysis_item ADD COLUMN IF NOT EXISTS digit_confidence JSONB DEFAULT '[]'::jsonb;

-- 2. Expand cm_competitor_reference with market segments
ALTER TABLE public.cm_competitor_reference ADD COLUMN IF NOT EXISTS market_segment VARCHAR(30) CHECK (market_segment IN ('ECONOMY', 'MAINSTREAM', 'PREMIUM', 'SUPER_PREMIUM'));

-- Update existing seeds for competitor market segments
UPDATE public.cm_competitor_reference SET market_segment = 'MAINSTREAM' WHERE brand_name IN ('Pilão', '3 Corações', 'Melitta');
UPDATE public.cm_competitor_reference SET market_segment = 'ECONOMY' WHERE brand_name = 'Santa Clara';
UPDATE public.cm_competitor_reference SET market_segment = 'PREMIUM' WHERE brand_name = 'L''Or';

-- 3. Expand cm_ai_price_analysis with confidence score, recommendations, and strategic snapshots
ALTER TABLE public.cm_ai_price_analysis ADD COLUMN IF NOT EXISTS ocr_confidence_score NUMERIC(5,2);
ALTER TABLE public.cm_ai_price_analysis ADD COLUMN IF NOT EXISTS price_recommendation JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cm_ai_price_analysis ADD COLUMN IF NOT EXISTS reference_min_price NUMERIC(10,2);
ALTER TABLE public.cm_ai_price_analysis ADD COLUMN IF NOT EXISTS reference_target_price NUMERIC(10,2);
ALTER TABLE public.cm_ai_price_analysis ADD COLUMN IF NOT EXISTS reference_max_price NUMERIC(10,2);

-- 4. Adjust check constraint on cm_ai_pricing_alert to include 'margin_risk' and 'price_anomaly'
ALTER TABLE public.cm_ai_pricing_alert DROP CONSTRAINT IF EXISTS cm_ai_pricing_alert_tipo_alerta_check;
ALTER TABLE public.cm_ai_pricing_alert ADD CONSTRAINT cm_ai_pricing_alert_tipo_alerta_check CHECK (tipo_alerta IN ('overpriced_versus_market', 'overpriced_versus_strategy', 'competitor_promo_detected', 'margin_risk', 'price_anomaly'));
