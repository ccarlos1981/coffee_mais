-- Migration: Sprint 5.2 Price OCR Refinements v2 (Ajustes Finais)
-- Description: Expand public.cm_ai_price_analysis table with commercial opportunity scores, window configurations, and outlier details.

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS commercial_opportunity VARCHAR(30) 
CHECK (commercial_opportunity IN ('DEFENSIVE', 'OFFENSIVE', 'EXPANSION', 'CRITICAL', 'STABLE'));

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS anomaly_reference_level VARCHAR(20) 
CHECK (anomaly_reference_level IN ('PDV', 'NETWORK', 'STATE', 'NATIONAL'));

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS anomaly_reference_sample_size INT;

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS anomaly_reference_window_days INT DEFAULT 30;

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS commercial_opportunity_score NUMERIC(5,2) DEFAULT 0.00;

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS had_outliers_removed BOOLEAN DEFAULT false;

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS outlier_count INT DEFAULT 0;

ALTER TABLE public.cm_ai_price_analysis 
ADD COLUMN IF NOT EXISTS outlier_values_removed JSONB DEFAULT '[]'::jsonb;

-- Add check constraint for commercial_opportunity_score (0 to 100)
ALTER TABLE public.cm_ai_price_analysis DROP CONSTRAINT IF EXISTS cm_ai_price_analysis_opportunity_score_check;
ALTER TABLE public.cm_ai_price_analysis 
ADD CONSTRAINT cm_ai_price_analysis_opportunity_score_check 
CHECK (commercial_opportunity_score >= 0 AND commercial_opportunity_score <= 100);
