-- ====================================================================
-- WAVE 12 — HARDENING DE TABELAS DRE LEGADAS (SPRINT 5)
-- Data: 28/08/2026
-- ====================================================================

-- Revogar políticas abertas FOR ALL em tabelas legadas do Sprint 5
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_import_logs" ON public.cm_dre_import_logs;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_import_logs" ON public.cm_dre_import_logs;
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_excel_raw" ON public.cm_dre_excel_raw;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_excel_raw" ON public.cm_dre_excel_raw;
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_financeiro" ON public.cm_dre_financeiro;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_financeiro" ON public.cm_dre_financeiro;
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_month_closure" ON public.cm_dre_month_closure;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_month_closure" ON public.cm_dre_month_closure;
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_alerts" ON public.cm_dre_alerts;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_alerts" ON public.cm_dre_alerts;
DROP POLICY IF EXISTS "Permitir leitura para autenticados em cm_dre_cache_metadata" ON public.cm_dre_cache_metadata;
DROP POLICY IF EXISTS "Permitir tudo para autenticados em cm_dre_cache_metadata" ON public.cm_dre_cache_metadata;

-- Criar políticas restritivas para leitura (Admin, Admin Master, Financeiro, CEO)
CREATE POLICY "cm_dre_import_logs_select_role" ON public.cm_dre_import_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_dre_excel_raw_select_role" ON public.cm_dre_excel_raw
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_dre_financeiro_select_role" ON public.cm_dre_financeiro
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_dre_month_closure_select_role" ON public.cm_dre_month_closure
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_dre_alerts_select_role" ON public.cm_dre_alerts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_dre_cache_metadata_select_role" ON public.cm_dre_cache_metadata
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro', 'CEO')
  )
);

-- Criar políticas restritivas para escrita (Admin, Admin Master, Financeiro)
CREATE POLICY "cm_dre_import_logs_write_admin" ON public.cm_dre_import_logs
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);

CREATE POLICY "cm_dre_excel_raw_write_admin" ON public.cm_dre_excel_raw
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);

CREATE POLICY "cm_dre_financeiro_write_admin" ON public.cm_dre_financeiro
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);

CREATE POLICY "cm_dre_month_closure_write_admin" ON public.cm_dre_month_closure
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);

CREATE POLICY "cm_dre_alerts_write_admin" ON public.cm_dre_alerts
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);

CREATE POLICY "cm_dre_cache_metadata_write_admin" ON public.cm_dre_cache_metadata
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Financeiro')
  )
);
