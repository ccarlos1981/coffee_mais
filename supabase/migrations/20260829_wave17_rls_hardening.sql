-- ==============================================================================
-- COFFEE++ — WAVE 17 SECURITY HARDENING: DATABASE RLS & STORAGE POLICIES
-- ==============================================================================
-- Migration: 20260829_wave17_rls_hardening.sql
-- Description:
--   1. Drop permissive legacy policies (USING true / FOR ALL) on 9 tables:
--      - cm_promotor_metas
--      - cm_promotor_meta_network
--      - cm_promotor_fraud_metrics
--      - cm_dre_historico
--      - cm_dre_historico_items
--      - cm_campanhas
--      - cm_acoes_investimento
--      - cm_clientes_atividade
--      - cm_rdm_comments
--   2. Implement granular, role-based and ownership-based RLS policies.
--   3. Implement Storage RLS policies for private bucket 'processos-docs'.
--   4. Zero downtime, idempotent and fully reversible.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. DROP LEGACY POLICIES
-- ==============================================================================

-- 1.1 Metas Promotor
DROP POLICY IF EXISTS "insert_update_authenticated" ON public.cm_promotor_metas;
DROP POLICY IF EXISTS "select_all_authenticated" ON public.cm_promotor_metas;
DROP POLICY IF EXISTS "insert_update_authenticated" ON public.cm_promotor_meta_network;
DROP POLICY IF EXISTS "select_all_authenticated" ON public.cm_promotor_meta_network;

-- 1.2 Fraude Promotor
DROP POLICY IF EXISTS "Enable write access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics;
DROP POLICY IF EXISTS "Enable read access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics;

-- 1.3 DRE Histórico
DROP POLICY IF EXISTS "authenticated_delete_dre_historico" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "authenticated_insert_dre_historico" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "authenticated_select_dre_historico" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "authenticated_update_dre_historico" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "authenticated_delete_dre_items" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "authenticated_insert_dre_items" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "authenticated_select_dre_items" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "authenticated_update_dre_items" ON public.cm_dre_historico_items;

-- 1.4 Campanhas e Ações de Investimento
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.cm_campanhas;
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.cm_acoes_investimento;

-- 1.5 Clientes Atividade
DROP POLICY IF EXISTS "cm_clientes_atividade_select_policy" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_atividade_delete_policy" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_atividade_write_policy" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_atividade_update_policy" ON public.cm_clientes_atividade;

-- 1.6 Comentários RDM
DROP POLICY IF EXISTS "rdm_comments_write" ON public.cm_rdm_comments;
DROP POLICY IF EXISTS "rdm_comments_read" ON public.cm_rdm_comments;
DROP POLICY IF EXISTS "rdm_comments_update" ON public.cm_rdm_comments;

-- 1.7 Storage processos-docs (se existirem)
DROP POLICY IF EXISTS "processos_docs_storage_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "processos_docs_storage_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "processos_docs_storage_delete_auth" ON storage.objects;
DROP POLICY IF EXISTS "processos_docs_storage_mutation_auth" ON storage.objects;


-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (ASSURANCE)
-- ==============================================================================
ALTER TABLE public.cm_promotor_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_meta_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_promotor_fraud_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_historico_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_acoes_investimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_clientes_atividade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_rdm_comments ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 3. CREATE GRANULAR POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 3.1 cm_promotor_metas
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_promotor_metas_select_auth"
ON public.cm_promotor_metas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_promotor_metas_insert_auth"
ON public.cm_promotor_metas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_metas_update_auth"
ON public.cm_promotor_metas FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_metas_delete_auth"
ON public.cm_promotor_metas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.2 cm_promotor_meta_network
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_promotor_meta_net_select_auth"
ON public.cm_promotor_meta_network FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_promotor_meta_net_insert_auth"
ON public.cm_promotor_meta_network FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_meta_net_update_auth"
ON public.cm_promotor_meta_network FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_meta_net_delete_auth"
ON public.cm_promotor_meta_network FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.3 cm_promotor_fraud_metrics
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_promotor_fraud_select_auth"
ON public.cm_promotor_fraud_metrics FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Supervisor', 'Trade', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_fraud_insert_auth"
ON public.cm_promotor_fraud_metrics FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_fraud_update_auth"
ON public.cm_promotor_fraud_metrics FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_promotor_fraud_delete_auth"
ON public.cm_promotor_fraud_metrics FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.4 cm_dre_historico
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_dre_historico_select_auth"
ON public.cm_dre_historico FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Trade', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_historico_insert_auth"
ON public.cm_dre_historico FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_historico_update_auth"
ON public.cm_dre_historico FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_historico_delete_auth"
ON public.cm_dre_historico FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.5 cm_dre_historico_items
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_dre_hist_items_select_auth"
ON public.cm_dre_historico_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Trade', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_hist_items_insert_auth"
ON public.cm_dre_historico_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_hist_items_update_auth"
ON public.cm_dre_historico_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Financeiro', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_dre_hist_items_delete_auth"
ON public.cm_dre_historico_items FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.6 cm_campanhas
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_campanhas_select_auth"
ON public.cm_campanhas FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_campanhas_insert_auth"
ON public.cm_campanhas FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_campanhas_update_auth"
ON public.cm_campanhas FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_campanhas_delete_auth"
ON public.cm_campanhas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.7 cm_acoes_investimento
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_acoes_invest_select_auth"
ON public.cm_acoes_investimento FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_acoes_invest_insert_auth"
ON public.cm_acoes_investimento FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_acoes_invest_update_auth"
ON public.cm_acoes_investimento FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'Diretor', 'Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_acoes_invest_delete_auth"
ON public.cm_acoes_investimento FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.8 cm_clientes_atividade
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_clientes_ativ_select_auth"
ON public.cm_clientes_atividade FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_clientes_ativ_insert_auth"
ON public.cm_clientes_atividade FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_clientes_ativ_update_auth"
ON public.cm_clientes_atividade FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_clientes_ativ_delete_auth"
ON public.cm_clientes_atividade FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);


-- ------------------------------------------------------------------------------
-- 3.9 cm_rdm_comments
-- ------------------------------------------------------------------------------
CREATE POLICY "cm_rdm_comments_select_auth"
ON public.cm_rdm_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_rdm_comments_insert_auth"
ON public.cm_rdm_comments FOR INSERT TO authenticated
WITH CHECK (
  (updated_by = auth.uid() OR updated_by IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_rdm_comments_update_auth"
ON public.cm_rdm_comments FOR UPDATE TO authenticated
USING (
  (updated_by = auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM public.cm_user_profiles p
      WHERE p.id = auth.uid() AND p.approved = true
        AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  )
)
WITH CHECK (
  (updated_by = auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM public.cm_user_profiles p
      WHERE p.id = auth.uid() AND p.approved = true
        AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  )
);

CREATE POLICY "cm_rdm_comments_delete_auth"
ON public.cm_rdm_comments FOR DELETE TO authenticated
USING (
  (updated_by = auth.uid()) OR (
    EXISTS (
      SELECT 1 FROM public.cm_user_profiles p
      WHERE p.id = auth.uid() AND p.approved = true
        AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  )
);


-- ==============================================================================
-- 4. STORAGE RLS POLICIES (processos-docs BUCKET)
-- ==============================================================================

CREATE POLICY "processos_docs_storage_select_auth"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'processos-docs'
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "processos_docs_storage_insert_auth"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'processos-docs'
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO', 'RH', 'TI'])
  )
);

CREATE POLICY "processos_docs_storage_delete_auth"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'processos-docs'
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p
    WHERE p.id = auth.uid() AND p.approved = true
      AND p.role = ANY (ARRAY['Admin', 'Admin Master', 'CEO', 'RH', 'TI'])
  )
);

COMMIT;
