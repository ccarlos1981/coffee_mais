-- Migration: Sprint 4.3 Observability and Fraud Intelligence
-- Description: Create cm_mobile_app_logs, cm_promotor_fraud_metrics, and update cm_promotor_visita_foto.

-- 1. Mobile App Logs (Observability)
CREATE TABLE IF NOT EXISTS public.cm_mobile_app_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    app_version TEXT NOT NULL,
    os TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
    payload_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Mobile Logs
ALTER TABLE public.cm_mobile_app_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.cm_mobile_app_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.cm_mobile_app_logs
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);


-- 2. Photo Fraud Columns
ALTER TABLE public.cm_promotor_visita_foto ADD COLUMN IF NOT EXISTS foto_hash_md5 TEXT;
ALTER TABLE public.cm_promotor_visita_foto ADD COLUMN IF NOT EXISTS foto_hash_perceptual TEXT NULL;


-- 3. Promotor Fraud Metrics (Aggregated Daily Score)
CREATE TABLE IF NOT EXISTS public.cm_promotor_fraud_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE NOT NULL,
    metric_date DATE DEFAULT CURRENT_DATE NOT NULL,
    fraud_score INT DEFAULT 100 NOT NULL CHECK (fraud_score BETWEEN 0 AND 100),
    gps_mock_count INT DEFAULT 0 NOT NULL,
    speed_violation_count INT DEFAULT 0 NOT NULL,
    duplicate_photo_count INT DEFAULT 0 NOT NULL,
    device_change_count INT DEFAULT 0 NOT NULL,
    edge_geofence_count INT DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id, metric_date)
);

-- Enable RLS for Fraud Metrics
ALTER TABLE public.cm_promotor_fraud_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics
    FOR ALL TO authenticated USING (true);


-- 4. Audit Triggers
DROP TRIGGER IF EXISTS audit_cm_mobile_app_logs ON public.cm_mobile_app_logs;
CREATE TRIGGER audit_cm_mobile_app_logs AFTER INSERT OR UPDATE OR DELETE ON public.cm_mobile_app_logs FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();

DROP TRIGGER IF EXISTS audit_cm_promotor_fraud_metrics ON public.cm_promotor_fraud_metrics;
CREATE TRIGGER audit_cm_promotor_fraud_metrics AFTER INSERT OR UPDATE OR DELETE ON public.cm_promotor_fraud_metrics FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();
