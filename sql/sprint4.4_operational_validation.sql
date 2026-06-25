-- Migration: Sprint 4.4 Operational Validation
-- Description: Create cm_mobile_feedback table with severity, RLS, and resolution tracking.

CREATE TABLE IF NOT EXISTS public.cm_mobile_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE NOT NULL,
    device_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('GPS ruim', 'App travou', 'Bateria drenando', 'Câmera falhou', 'Sincronização lenta')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT,
    device_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    device_info JSONB,
    is_resolved BOOLEAN DEFAULT false NOT NULL,
    resolved_by UUID REFERENCES public.cm_employees(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Mobile Feedback
ALTER TABLE public.cm_mobile_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users on feedback" ON public.cm_mobile_feedback;
CREATE POLICY "Enable read access for authenticated users on feedback" ON public.cm_mobile_feedback
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert access for authenticated users on feedback" ON public.cm_mobile_feedback;
CREATE POLICY "Enable insert access for authenticated users on feedback" ON public.cm_mobile_feedback
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Enable update access for supervisors on feedback" ON public.cm_mobile_feedback;
CREATE POLICY "Enable update access for supervisors on feedback" ON public.cm_mobile_feedback
    FOR UPDATE TO authenticated USING (true);

-- Audit trigger
DROP TRIGGER IF EXISTS audit_cm_mobile_feedback ON public.cm_mobile_feedback;
CREATE TRIGGER audit_cm_mobile_feedback AFTER INSERT OR UPDATE OR DELETE ON public.cm_mobile_feedback FOR EACH ROW EXECUTE FUNCTION public.cm_audit_trigger_func();
