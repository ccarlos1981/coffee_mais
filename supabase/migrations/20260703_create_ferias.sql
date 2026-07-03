-- Create cm_ferias table
CREATE TABLE IF NOT EXISTS public.cm_ferias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT check_dates CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.cm_ferias ENABLE ROW LEVEL SECURITY;

-- Select policy: all authenticated users can read
CREATE POLICY cm_ferias_select ON public.cm_ferias
FOR SELECT
TO authenticated
USING (true);

-- Insert policy: authenticated users who are Admins/CEOs/etc., or inserting their own name/manager_name
CREATE POLICY cm_ferias_insert ON public.cm_ferias
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cm_user_profiles
    WHERE cm_user_profiles.id = auth.uid()
      AND (
        cm_user_profiles.role = ANY (ARRAY['Admin'::text, 'CEO'::text, 'Diretor'::text, 'Gerente Nacional'::text])
        OR cm_user_profiles.name = cm_ferias.employee_name
        OR cm_user_profiles.manager_name = cm_ferias.employee_name
      )
  )
);

-- Update policy
CREATE POLICY cm_ferias_update ON public.cm_ferias
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cm_user_profiles
    WHERE cm_user_profiles.id = auth.uid()
      AND (
        cm_user_profiles.role = ANY (ARRAY['Admin'::text, 'CEO'::text, 'Diretor'::text, 'Gerente Nacional'::text])
        OR cm_user_profiles.name = cm_ferias.employee_name
        OR cm_user_profiles.manager_name = cm_ferias.employee_name
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cm_user_profiles
    WHERE cm_user_profiles.id = auth.uid()
      AND (
        cm_user_profiles.role = ANY (ARRAY['Admin'::text, 'CEO'::text, 'Diretor'::text, 'Gerente Nacional'::text])
        OR cm_user_profiles.name = cm_ferias.employee_name
        OR cm_user_profiles.manager_name = cm_ferias.employee_name
      )
  )
);

-- Delete policy
CREATE POLICY cm_ferias_delete ON public.cm_ferias
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cm_user_profiles
    WHERE cm_user_profiles.id = auth.uid()
      AND (
        cm_user_profiles.role = ANY (ARRAY['Admin'::text, 'CEO'::text, 'Diretor'::text, 'Gerente Nacional'::text])
        OR cm_user_profiles.name = cm_ferias.employee_name
        OR cm_user_profiles.manager_name = cm_ferias.employee_name
      )
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cm_ferias_employee_dates ON public.cm_ferias (employee_name, start_date, end_date);
