-- Migration: Create cm_promotor_device_binding table
-- Description: Table to bind and authorize devices per promotor to prevent concurrent logins and unauthorized devices.

CREATE TABLE IF NOT EXISTS public.cm_promotor_device_binding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_model TEXT,
    os_name TEXT, -- 'Android' or 'iOS'
    os_version TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotor_id, device_fingerprint)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cm_promotor_device_binding ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
CREATE POLICY "Enable read access for authenticated users" ON public.cm_promotor_device_binding
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON public.cm_promotor_device_binding
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for employees themselves or supervisor" ON public.cm_promotor_device_binding
    FOR UPDATE TO authenticated USING (
        -- Promotor profile match or gestor check
        EXISTS (
            SELECT 1 FROM public.cm_user_profiles p
            WHERE p.id = auth.uid() 
            AND (p.role IN ('Supervisor', 'CEO', 'Admin', 'Trade'))
        )
    );
