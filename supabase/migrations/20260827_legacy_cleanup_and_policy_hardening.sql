-- ============================================================================
-- WAVE 7 — LEGACY DATABASE CLEANUP & POLICY REFINEMENT (P3/P4 HARDENING)
-- Data: 2026-08-27
-- Objetivo:
-- 1. Remoção controlada de views legadas órfãs (vw_sales_summary, vw_matrix_ranking)
-- 2. Remoção controlada de tabelas órfãs Classe A (network_results, investimento_cliente, pdv_mapping_legacy, sales_legacy)
-- 3. Refinamento de policies de ceo_targets e manager_uf_mapping
-- 4. Preservação integral de upload_batches e products
-- ============================================================================

-- 1. DROP DAS VIEWS LEGADAS ÓRFÃS
DROP VIEW IF EXISTS public.vw_sales_summary;
DROP VIEW IF EXISTS public.vw_matrix_ranking;

-- 2. DROP DAS TABELAS ÓRFÃS COMPROVADAS
DROP TABLE IF EXISTS public.network_results;
DROP TABLE IF EXISTS public.investimento_cliente;
DROP TABLE IF EXISTS public.pdv_mapping_legacy;
DROP TABLE IF EXISTS public.sales_legacy;

-- 3. REFINAMENTO DE POLICIES: ceo_targets
REVOKE ALL ON public.ceo_targets FROM anon;

DROP POLICY IF EXISTS "Enable all actions for all users" ON public.ceo_targets;
DROP POLICY IF EXISTS "ceo_targets_select_auth" ON public.ceo_targets;
DROP POLICY IF EXISTS "ceo_targets_manage_auth" ON public.ceo_targets;

CREATE POLICY "ceo_targets_select_auth" ON public.ceo_targets
FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM cm_user_profiles WHERE approved = true)
);

CREATE POLICY "ceo_targets_manage_auth" ON public.ceo_targets
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

-- 4. REFINAMENTO DE POLICIES: manager_uf_mapping
REVOKE ALL ON public.manager_uf_mapping FROM anon;

DROP POLICY IF EXISTS "Enable all for manager_uf" ON public.manager_uf_mapping;
DROP POLICY IF EXISTS "manager_uf_mapping_select_auth" ON public.manager_uf_mapping;
DROP POLICY IF EXISTS "manager_uf_mapping_manage_auth" ON public.manager_uf_mapping;

CREATE POLICY "manager_uf_mapping_select_auth" ON public.manager_uf_mapping
FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM cm_user_profiles WHERE approved = true)
);

CREATE POLICY "manager_uf_mapping_manage_auth" ON public.manager_uf_mapping
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);
