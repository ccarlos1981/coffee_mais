-- Migration: Sprint 6.1 Refinements
-- Description: Add company_id to cm_trade_action_simulation, normalize feedback, add fingerprint and alternative_actions.

-- 1. Add company_id to cm_trade_action_simulation
ALTER TABLE public.cm_trade_action_simulation 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.cm_company(id) ON DELETE CASCADE;

-- 2. Add columns to cm_ai_recommendation
ALTER TABLE public.cm_ai_recommendation 
ADD COLUMN IF NOT EXISTS recommendation_fingerprint VARCHAR(100),
ADD COLUMN IF NOT EXISTS alternative_actions JSONB DEFAULT '[]'::jsonb;

-- 3. Create Unique Index for Deduplication of OPEN recommendations
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_open_fingerprint 
ON public.cm_ai_recommendation(recommendation_fingerprint) 
WHERE (status = 'OPEN');

-- 4. Create Normalized Recommendation Feedback Table
CREATE TABLE IF NOT EXISTS public.cm_ai_recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES public.cm_ai_recommendation(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('EXECUTED', 'DISMISSED')),
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_notes TEXT,
    executed_by UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_recommendation_feedback UNIQUE (recommendation_id)
);

-- Enable RLS for feedback
ALTER TABLE public.cm_ai_recommendation_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_recommendation_feedback ON public.cm_ai_recommendation_feedback;
CREATE POLICY select_recommendation_feedback ON public.cm_ai_recommendation_feedback FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_recommendation_feedback ON public.cm_ai_recommendation_feedback;
CREATE POLICY manage_recommendation_feedback ON public.cm_ai_recommendation_feedback FOR ALL TO authenticated USING (true);

-- 5. Drop deprecated columns from cm_ai_recommendation
ALTER TABLE public.cm_ai_recommendation 
DROP COLUMN IF EXISTS executed_by,
DROP COLUMN IF EXISTS executed_at,
DROP COLUMN IF EXISTS execution_feedback;
