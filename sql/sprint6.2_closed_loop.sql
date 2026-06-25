-- Migration: Sprint 6.2 Closed Loop Learning & Autonomous AI Optimization
-- Description: Create tables for model performance tracking, historical weights, learning events, and model alerts.

-- 1. Create Model Performance Table
CREATE TABLE IF NOT EXISTS public.cm_ai_model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    total_predictions INT DEFAULT 0,
    successful_predictions INT DEFAULT 0,
    avg_prediction_error NUMERIC(10,2) DEFAULT 0.00,
    avg_expected_roi NUMERIC(10,2) DEFAULT 0.00,
    avg_realized_roi NUMERIC(10,2) DEFAULT 0.00,
    model_confidence_score NUMERIC(5,2) DEFAULT 100.00,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_company_rec_type UNIQUE (company_id, recommendation_type)
);

-- 2. Create Learning Event Table
CREATE TABLE IF NOT EXISTS public.cm_ai_learning_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    recommendation_id UUID NOT NULL REFERENCES public.cm_ai_recommendation(id) ON DELETE CASCADE,
    predicted_sellout NUMERIC(15,2) NOT NULL,
    actual_sellout NUMERIC(15,2) NOT NULL,
    predicted_roi NUMERIC(10,2) NOT NULL,
    actual_roi NUMERIC(10,2) NOT NULL,
    prediction_error_percent NUMERIC(10,2) NOT NULL,
    learning_weight NUMERIC(5,2) NOT NULL,
    manual_rating INT CHECK (manual_rating BETWEEN 1 AND 5),
    real_sellout_source VARCHAR(20) NOT NULL CHECK (real_sellout_source IN ('MANUAL','REAL_SALES','SIMULATED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Model Weights Table
CREATE TABLE IF NOT EXISTS public.cm_ai_model_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    impact_weight NUMERIC(5,2) NOT NULL,
    roi_weight NUMERIC(5,2) NOT NULL,
    urgency_weight NUMERIC(5,2) NOT NULL,
    execution_weight NUMERIC(5,2) NOT NULL,
    strategic_weight NUMERIC(5,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Model Alert Table
CREATE TABLE IF NOT EXISTS public.cm_ai_model_alert (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.cm_company(id) ON DELETE CASCADE,
    alert_type VARCHAR(30) NOT NULL CHECK (alert_type IN ('CONFIDENCE_DROP', 'HIGH_PREDICTION_ERROR', 'ROI_DRIFT', 'WEIGHT_INSTABILITY')),
    recommendation_type VARCHAR(50) NOT NULL,
    alert_message TEXT NOT NULL,
    metric_value NUMERIC(10,2) NOT NULL,
    threshold_value NUMERIC(10,2) NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE public.cm_ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_ai_learning_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_ai_model_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_ai_model_alert ENABLE ROW LEVEL SECURITY;

-- Create Policies (All authenticated users can read/manage)
DROP POLICY IF EXISTS select_model_perf ON public.cm_ai_model_performance;
CREATE POLICY select_model_perf ON public.cm_ai_model_performance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_model_perf ON public.cm_ai_model_performance;
CREATE POLICY manage_model_perf ON public.cm_ai_model_performance FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS select_learning_event ON public.cm_ai_learning_event;
CREATE POLICY select_learning_event ON public.cm_ai_learning_event FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_learning_event ON public.cm_ai_learning_event;
CREATE POLICY manage_learning_event ON public.cm_ai_learning_event FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS select_model_weights ON public.cm_ai_model_weights;
CREATE POLICY select_model_weights ON public.cm_ai_model_weights FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_model_weights ON public.cm_ai_model_weights;
CREATE POLICY manage_model_weights ON public.cm_ai_model_weights FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS select_model_alert ON public.cm_ai_model_alert;
CREATE POLICY select_model_alert ON public.cm_ai_model_alert FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_model_alert ON public.cm_ai_model_alert;
CREATE POLICY manage_model_alert ON public.cm_ai_model_alert FOR ALL TO authenticated USING (true);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_learning_rec ON public.cm_ai_learning_event(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_model_perf_type ON public.cm_ai_model_performance(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_model_weights_company ON public.cm_ai_model_weights(company_id);
CREATE INDEX IF NOT EXISTS idx_model_alert_company ON public.cm_ai_model_alert(company_id);

-- 7. Register Dashboard Widget
INSERT INTO public.cm_dashboard_widget_config (company_id, widget_key, widget_order, is_enabled)
VALUES ('e143e8d6-c7d7-4315-8f54-aa12ce554d2d', 'ai_learning', 7, true)
ON CONFLICT (company_id, widget_key) DO UPDATE SET is_enabled = true;
