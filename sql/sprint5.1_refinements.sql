-- Migration: Sprint 5.1 AI Shelf Recognition & Planogram Compliance Refinements
-- Description: Expand tables with quality gates, versioning, business priority, manual review fields, and seeds.

-- 1. Expand cm_ai_product_reference with business priority
ALTER TABLE public.cm_ai_product_reference 
ADD COLUMN IF NOT EXISTS business_priority INT DEFAULT 3 CHECK (business_priority >= 1 AND business_priority <= 5);

-- Update existing SKU business priorities
UPDATE public.cm_ai_product_reference SET business_priority = 5 WHERE sku = 'COFFEE_MAIS_CLASSICO';
UPDATE public.cm_ai_product_reference SET business_priority = 4 WHERE sku = 'COFFEE_MAIS_INTENSO';
UPDATE public.cm_ai_product_reference SET business_priority = 3 WHERE sku = 'COFFEE_MAIS_GOURMET';
UPDATE public.cm_ai_product_reference SET business_priority = 2 WHERE sku = 'COFFEE_MAIS_ESPRESSO';

-- 2. Expand cm_pdv_planograma with versioning fields
ALTER TABLE public.cm_pdv_planograma 
ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS planogram_version INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Drop old unique constraint and add versioned unique constraint
ALTER TABLE public.cm_pdv_planograma DROP CONSTRAINT IF EXISTS unique_pdv_sku;
ALTER TABLE public.cm_pdv_planograma DROP CONSTRAINT IF EXISTS cm_pdv_planograma_pdv_id_sku_key;
DROP INDEX IF EXISTS unique_pdv_sku;

-- Create composite unique index for versioning
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_pdv_planograma_unique_version 
ON public.cm_pdv_planograma(pdv_id, sku, planogram_version);

-- Update existing planograms to have default version values
UPDATE public.cm_pdv_planograma 
SET planogram_version = 1, is_active = true 
WHERE planogram_version IS NULL;

-- 3. Expand cm_ai_shelf_analysis with quality, review, versioning, annotated image, and decision reasons
ALTER TABLE public.cm_ai_shelf_analysis 
ADD COLUMN IF NOT EXISTS quality_score INT DEFAULT 100 CHECK (quality_score >= 0 AND quality_score <= 100),
ADD COLUMN IF NOT EXISTS quality_status VARCHAR(30) DEFAULT 'GOOD' CHECK (quality_status IN ('GOOD', 'DARK', 'BLURRED', 'CROPPED', 'OVEREXPOSED')),
ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS review_reason TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.cm_employees(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS planogram_version_used INT,
ADD COLUMN IF NOT EXISTS annotated_image_url TEXT,
ADD COLUMN IF NOT EXISTS decision_reasons JSONB DEFAULT '[]'::jsonb;
