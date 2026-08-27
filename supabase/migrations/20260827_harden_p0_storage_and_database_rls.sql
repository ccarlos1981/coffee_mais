-- ============================================================
-- MIGRATION: 20260827_harden_p0_storage_and_database_rls.sql
-- WAVE 3 — REMEDIAÇÃO CIRÚRGICA DOS P0 DE STORAGE E DATABASE RLS
-- ============================================================

-- ------------------------------------------------------------
-- 1. P0-01: STORAGE / BUCKET excel-uploads
-- Eliminar policies anônimas (Allow read uploads / Allow uploads)
-- e restringir a authenticated com papéis autorizados
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Allow read uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads" ON storage.objects;
DROP POLICY IF EXISTS "excel_uploads_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "excel_uploads_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "excel_uploads_delete_auth" ON storage.objects;

CREATE POLICY "excel_uploads_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'excel-uploads'
  AND (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Trade'::text, 'Financeiro'::text, 'Diretor'::text])
    )
  )
);

CREATE POLICY "excel_uploads_insert_auth"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'excel-uploads'
  AND (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Trade'::text, 'Financeiro'::text, 'Diretor'::text])
    )
  )
);

CREATE POLICY "excel_uploads_delete_auth"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'excel-uploads'
  AND (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
    )
  )
);

-- ------------------------------------------------------------
-- 2. P0-02: DATABASE RLS / public.cm_weekly_projections
-- Eliminar policy pública irrestrita e implementar menor privilégio
-- ------------------------------------------------------------

ALTER TABLE public.cm_weekly_projections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to cm_weekly_projections" ON public.cm_weekly_projections;
DROP POLICY IF EXISTS "cm_weekly_projections_select_auth" ON public.cm_weekly_projections;
DROP POLICY IF EXISTS "cm_weekly_projections_insert_auth" ON public.cm_weekly_projections;
DROP POLICY IF EXISTS "cm_weekly_projections_update_auth" ON public.cm_weekly_projections;
DROP POLICY IF EXISTS "cm_weekly_projections_delete_auth" ON public.cm_weekly_projections;

-- Leitura: Usuários autenticados e aprovados
CREATE POLICY "cm_weekly_projections_select_auth"
ON public.cm_weekly_projections
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
  )
);

-- Inserção: Perfis administrativos e comerciais autorizados
CREATE POLICY "cm_weekly_projections_insert_auth"
ON public.cm_weekly_projections
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Gerente Nacional'::text, 'Diretor'::text, 'Gerente Regional'::text, 'Trade'::text])
  )
);

-- Atualização: Perfis administrativos e comerciais autorizados
CREATE POLICY "cm_weekly_projections_update_auth"
ON public.cm_weekly_projections
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Gerente Nacional'::text, 'Diretor'::text, 'Gerente Regional'::text, 'Trade'::text])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Gerente Nacional'::text, 'Diretor'::text, 'Gerente Regional'::text, 'Trade'::text])
  )
);

-- Exclusão: Exclusivamente administradores
CREATE POLICY "cm_weekly_projections_delete_auth"
ON public.cm_weekly_projections
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
  )
);

-- ------------------------------------------------------------
-- 3. P0-03: DATABASE RLS / public.cm_report_recipients
-- Eliminar policy pública irrestrita e restringir a gestão administrativa
-- ------------------------------------------------------------

ALTER TABLE public.cm_report_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable ALL for all authenticated users" ON public.cm_report_recipients;
DROP POLICY IF EXISTS "cm_report_recipients_select_auth" ON public.cm_report_recipients;
DROP POLICY IF EXISTS "cm_report_recipients_insert_auth" ON public.cm_report_recipients;
DROP POLICY IF EXISTS "cm_report_recipients_update_auth" ON public.cm_report_recipients;
DROP POLICY IF EXISTS "cm_report_recipients_delete_auth" ON public.cm_report_recipients;

-- Leitura: Perfis de gestão e liderança
CREATE POLICY "cm_report_recipients_select_auth"
ON public.cm_report_recipients
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text, 'Diretor'::text, 'Gerente Nacional'::text])
  )
);

-- Inserção: Exclusivamente administradores
CREATE POLICY "cm_report_recipients_insert_auth"
ON public.cm_report_recipients
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
  )
);

-- Atualização: Exclusivamente administradores
CREATE POLICY "cm_report_recipients_update_auth"
ON public.cm_report_recipients
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
  )
);

-- Exclusão: Exclusivamente administradores
CREATE POLICY "cm_report_recipients_delete_auth"
ON public.cm_report_recipients
FOR DELETE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles
    WHERE approved = true
      AND role = ANY (ARRAY['Admin'::text, 'Admin Master'::text, 'CEO'::text])
  )
);
