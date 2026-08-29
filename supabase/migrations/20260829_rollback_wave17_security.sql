-- ==============================================================================
-- COFFEE++ — ROLLBACK MIGRATION FOR WAVE 17 SECURITY HARDENING
-- ==============================================================================
-- Migration: 20260829_rollback_wave17_security.sql
-- Description:
--   Restores exact pre-Wave-17 state of policies for the 9 tables and storage.
-- ==============================================================================

BEGIN;

-- 1. DROP WAVE 17 POLICIES
DROP POLICY IF EXISTS "cm_promotor_metas_select_auth" ON public.cm_promotor_metas;
DROP POLICY IF EXISTS "cm_promotor_metas_insert_auth" ON public.cm_promotor_metas;
DROP POLICY IF EXISTS "cm_promotor_metas_update_auth" ON public.cm_promotor_metas;
DROP POLICY IF EXISTS "cm_promotor_metas_delete_auth" ON public.cm_promotor_metas;

DROP POLICY IF EXISTS "cm_promotor_meta_net_select_auth" ON public.cm_promotor_meta_network;
DROP POLICY IF EXISTS "cm_promotor_meta_net_insert_auth" ON public.cm_promotor_meta_network;
DROP POLICY IF EXISTS "cm_promotor_meta_net_update_auth" ON public.cm_promotor_meta_network;
DROP POLICY IF EXISTS "cm_promotor_meta_net_delete_auth" ON public.cm_promotor_meta_network;

DROP POLICY IF EXISTS "cm_promotor_fraud_select_auth" ON public.cm_promotor_fraud_metrics;
DROP POLICY IF EXISTS "cm_promotor_fraud_insert_auth" ON public.cm_promotor_fraud_metrics;
DROP POLICY IF EXISTS "cm_promotor_fraud_update_auth" ON public.cm_promotor_fraud_metrics;
DROP POLICY IF EXISTS "cm_promotor_fraud_delete_auth" ON public.cm_promotor_fraud_metrics;

DROP POLICY IF EXISTS "cm_dre_historico_select_auth" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "cm_dre_historico_insert_auth" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "cm_dre_historico_update_auth" ON public.cm_dre_historico;
DROP POLICY IF EXISTS "cm_dre_historico_delete_auth" ON public.cm_dre_historico;

DROP POLICY IF EXISTS "cm_dre_hist_items_select_auth" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "cm_dre_hist_items_insert_auth" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "cm_dre_hist_items_update_auth" ON public.cm_dre_historico_items;
DROP POLICY IF EXISTS "cm_dre_hist_items_delete_auth" ON public.cm_dre_historico_items;

DROP POLICY IF EXISTS "cm_campanhas_select_auth" ON public.cm_campanhas;
DROP POLICY IF EXISTS "cm_campanhas_insert_auth" ON public.cm_campanhas;
DROP POLICY IF EXISTS "cm_campanhas_update_auth" ON public.cm_campanhas;
DROP POLICY IF EXISTS "cm_campanhas_delete_auth" ON public.cm_campanhas;

DROP POLICY IF EXISTS "cm_acoes_invest_select_auth" ON public.cm_acoes_investimento;
DROP POLICY IF EXISTS "cm_acoes_invest_insert_auth" ON public.cm_acoes_investimento;
DROP POLICY IF EXISTS "cm_acoes_invest_update_auth" ON public.cm_acoes_investimento;
DROP POLICY IF EXISTS "cm_acoes_invest_delete_auth" ON public.cm_acoes_investimento;

DROP POLICY IF EXISTS "cm_clientes_ativ_select_auth" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_ativ_insert_auth" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_ativ_update_auth" ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS "cm_clientes_ativ_delete_auth" ON public.cm_clientes_atividade;

DROP POLICY IF EXISTS "cm_rdm_comments_select_auth" ON public.cm_rdm_comments;
DROP POLICY IF EXISTS "cm_rdm_comments_insert_auth" ON public.cm_rdm_comments;
DROP POLICY IF EXISTS "cm_rdm_comments_update_auth" ON public.cm_rdm_comments;
DROP POLICY IF EXISTS "cm_rdm_comments_delete_auth" ON public.cm_rdm_comments;

DROP POLICY IF EXISTS "processos_docs_storage_select_auth" ON storage.objects;
DROP POLICY IF EXISTS "processos_docs_storage_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "processos_docs_storage_delete_auth" ON storage.objects;

-- 2. RE-CREATE LEGACY POLICIES
CREATE POLICY "insert_update_authenticated" ON public.cm_promotor_metas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "select_all_authenticated" ON public.cm_promotor_metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_update_authenticated" ON public.cm_promotor_meta_network FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "select_all_authenticated" ON public.cm_promotor_meta_network FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable write access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable read access for authenticated users on fraud metrics" ON public.cm_promotor_fraud_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_delete_dre_historico" ON public.cm_dre_historico FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_dre_historico" ON public.cm_dre_historico FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_select_dre_historico" ON public.cm_dre_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_dre_historico" ON public.cm_dre_historico FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_delete_dre_items" ON public.cm_dre_historico_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_insert_dre_items" ON public.cm_dre_historico_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_select_dre_items" ON public.cm_dre_historico_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_dre_items" ON public.cm_dre_historico_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow all authenticated users full access" ON public.cm_campanhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all authenticated users full access" ON public.cm_acoes_investimento FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "cm_clientes_atividade_select_policy" ON public.cm_clientes_atividade FOR SELECT TO public USING (true);
CREATE POLICY "cm_clientes_atividade_delete_policy" ON public.cm_clientes_atividade FOR DELETE TO authenticated USING (true);
CREATE POLICY "cm_clientes_atividade_write_policy" ON public.cm_clientes_atividade FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cm_clientes_atividade_update_policy" ON public.cm_clientes_atividade FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "rdm_comments_write" ON public.cm_rdm_comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "rdm_comments_read" ON public.cm_rdm_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "rdm_comments_update" ON public.cm_rdm_comments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMIT;
