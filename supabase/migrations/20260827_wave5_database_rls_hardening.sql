-- ============================================================================
-- WAVE 5 — DATABASE RLS HARDENING & PRIVILEGE REVOCATION
-- Data: 2026-08-27
-- Objetivo: Ativar RLS e criar policies restritas para cm_sync_logs,
--           network_matrix, cm_promotor_agenda_diaria, tabelas legadas e cm_*
-- ============================================================================

-- 1. ATIVAR RLS EM TODAS AS TABELAS QUE ESTAVAM SEM RLS
ALTER TABLE public.cm_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_skus_conversao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_rps_custom_carteira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_faturamento_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_mv_refresh_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_rede_aliases ENABLE ROW LEVEL SECURITY;

-- 2. REVOGAR PRIVILÉGIOS DE ACESSO DIRETO DA ROLE ANON
REVOKE ALL ON public.cm_sync_logs FROM anon;
REVOKE ALL ON public.cm_promotor_agenda_diaria FROM anon;
REVOKE ALL ON public.network_matrix FROM anon;
REVOKE ALL ON public.base_atendimento FROM anon;
REVOKE ALL ON public.pdvs FROM anon;
REVOKE ALL ON public.sales_v2 FROM anon;
REVOKE ALL ON public.targets FROM anon;
REVOKE ALL ON public.cm_skus_conversao FROM anon;
REVOKE ALL ON public.cm_rps_custom_carteira FROM anon;
REVOKE ALL ON public.cm_faturamento_staging FROM anon;
REVOKE ALL ON public.cm_mv_refresh_jobs FROM anon;
REVOKE ALL ON public.cm_dre_rede_aliases FROM anon;
REVOKE ALL ON public.cm_ai_shelf_analysis FROM anon;
REVOKE ALL ON public.cm_ai_price_analysis FROM anon;
REVOKE ALL ON public.cm_ai_price_analysis_item FROM anon;

-- 3. REVOGAR EXECUTE PÚBLICO/ANON EM RPCS ADMINISTRATIVAS
REVOKE EXECUTE ON FUNCTION public.executar_atomic_swap_faturamento(text, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.confirmar_importacao_faturamento(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.promover_lote_faturamento(text, uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_bulk_insert_staging(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_acquire_import_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_release_import_lock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_trigger_refresh_clientes_atividade_manual() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_views() FROM anon, public;

-- 4. DROPAR POLICIES PÚBLICAS / INSEGURAS / QUAL = TRUE
DROP POLICY IF EXISTS "anon_read_all" ON public.network_matrix;
DROP POLICY IF EXISTS "network_matrix_select_auth" ON public.network_matrix;
DROP POLICY IF EXISTS "network_matrix_manage_auth" ON public.network_matrix;

DROP POLICY IF EXISTS "Escrita automática de agenda" ON public.cm_promotor_agenda_diaria;
DROP POLICY IF EXISTS "Leitura de agenda propria ou geral para gestores" ON public.cm_promotor_agenda_diaria;
DROP POLICY IF EXISTS "cm_promotor_agenda_diaria_select_auth" ON public.cm_promotor_agenda_diaria;
DROP POLICY IF EXISTS "cm_promotor_agenda_diaria_insert_auth" ON public.cm_promotor_agenda_diaria;
DROP POLICY IF EXISTS "cm_promotor_agenda_diaria_update_auth" ON public.cm_promotor_agenda_diaria;
DROP POLICY IF EXISTS "cm_promotor_agenda_diaria_delete_auth" ON public.cm_promotor_agenda_diaria;

DROP POLICY IF EXISTS "Allow all authenticated users to read base_atendimento" ON public.base_atendimento;
DROP POLICY IF EXISTS "Enable delete for all" ON public.base_atendimento;
DROP POLICY IF EXISTS "Enable read for all" ON public.base_atendimento;
DROP POLICY IF EXISTS "Enable update for all" ON public.base_atendimento;
DROP POLICY IF EXISTS "Enable write for all" ON public.base_atendimento;
DROP POLICY IF EXISTS "base_atendimento_select_auth" ON public.base_atendimento;
DROP POLICY IF EXISTS "base_atendimento_manage_auth" ON public.base_atendimento;

DROP POLICY IF EXISTS "Enable delete access for all users" ON public.pdvs;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.pdvs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.pdvs;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.pdvs;
DROP POLICY IF EXISTS "pdvs_select_auth" ON public.pdvs;
DROP POLICY IF EXISTS "pdvs_manage_auth" ON public.pdvs;

DROP POLICY IF EXISTS "Enable delete for all" ON public.sales_v2;
DROP POLICY IF EXISTS "Enable read for all" ON public.sales_v2;
DROP POLICY IF EXISTS "Enable update for all" ON public.sales_v2;
DROP POLICY IF EXISTS "Enable write for all" ON public.sales_v2;
DROP POLICY IF EXISTS "sales_v2_select_auth" ON public.sales_v2;
DROP POLICY IF EXISTS "sales_v2_manage_auth" ON public.sales_v2;

DROP POLICY IF EXISTS "anon_delete" ON public.targets;
DROP POLICY IF EXISTS "anon_insert" ON public.targets;
DROP POLICY IF EXISTS "anon_read_all" ON public.targets;
DROP POLICY IF EXISTS "anon_update" ON public.targets;
DROP POLICY IF EXISTS "authenticated_delete" ON public.targets;
DROP POLICY IF EXISTS "authenticated_insert" ON public.targets;
DROP POLICY IF EXISTS "authenticated_read_all" ON public.targets;
DROP POLICY IF EXISTS "authenticated_update" ON public.targets;
DROP POLICY IF EXISTS "targets_select_auth" ON public.targets;
DROP POLICY IF EXISTS "targets_manage_auth" ON public.targets;

DROP POLICY IF EXISTS "cm_sync_logs_select_auth" ON public.cm_sync_logs;
DROP POLICY IF EXISTS "cm_skus_conversao_select_auth" ON public.cm_skus_conversao;
DROP POLICY IF EXISTS "cm_skus_conversao_manage_auth" ON public.cm_skus_conversao;
DROP POLICY IF EXISTS "cm_rps_custom_carteira_select_auth" ON public.cm_rps_custom_carteira;
DROP POLICY IF EXISTS "cm_rps_custom_carteira_manage_auth" ON public.cm_rps_custom_carteira;
DROP POLICY IF EXISTS "cm_faturamento_staging_select_auth" ON public.cm_faturamento_staging;
DROP POLICY IF EXISTS "cm_mv_refresh_jobs_select_auth" ON public.cm_mv_refresh_jobs;
DROP POLICY IF EXISTS "cm_dre_rede_aliases_select_auth" ON public.cm_dre_rede_aliases;
DROP POLICY IF EXISTS "cm_dre_rede_aliases_manage_auth" ON public.cm_dre_rede_aliases;

DROP POLICY IF EXISTS "manage_ai_shelf_analysis" ON public.cm_ai_shelf_analysis;
DROP POLICY IF EXISTS "cm_ai_shelf_analysis_select_auth" ON public.cm_ai_shelf_analysis;
DROP POLICY IF EXISTS "cm_ai_shelf_analysis_manage_auth" ON public.cm_ai_shelf_analysis;

DROP POLICY IF EXISTS "manage_ai_price_analysis" ON public.cm_ai_price_analysis;
DROP POLICY IF EXISTS "cm_ai_price_analysis_select_auth" ON public.cm_ai_price_analysis;
DROP POLICY IF EXISTS "cm_ai_price_analysis_manage_auth" ON public.cm_ai_price_analysis;

DROP POLICY IF EXISTS "manage_ai_price_analysis_item" ON public.cm_ai_price_analysis_item;
DROP POLICY IF EXISTS "cm_ai_price_analysis_item_select_auth" ON public.cm_ai_price_analysis_item;
DROP POLICY IF EXISTS "cm_ai_price_analysis_item_manage_auth" ON public.cm_ai_price_analysis_item;

-- 5. CRIAR POLICIES RESTRITAS HOMOLOGADAS

-- 5.1 cm_sync_logs
CREATE POLICY "cm_sync_logs_select_auth" ON public.cm_sync_logs
FOR SELECT TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro', 'Diretor'])
  ))
  OR (metadata->>'user_id' = auth.uid()::text)
  OR (metadata->>'uploaded_by' = auth.uid()::text)
);

-- 5.2 cm_promotor_agenda_diaria
CREATE POLICY "cm_promotor_agenda_diaria_select_auth" ON public.cm_promotor_agenda_diaria
FOR SELECT TO authenticated
USING (
  (auth.uid() = (SELECT user_id FROM cm_promotor_perfil WHERE employee_id = cm_promotor_agenda_diaria.promotor_id))
  OR (promotor_id = auth.uid())
  OR (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Supervisor', 'CEO', 'Admin', 'Admin Master', 'Trade', 'Gerente Nacional', 'Diretor', 'Gerente Regional'])
  ))
);

CREATE POLICY "cm_promotor_agenda_diaria_insert_auth" ON public.cm_promotor_agenda_diaria
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Supervisor', 'CEO', 'Admin', 'Admin Master', 'Trade'])
  ))
  OR (promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid()))
  OR (promotor_id = auth.uid())
);

CREATE POLICY "cm_promotor_agenda_diaria_update_auth" ON public.cm_promotor_agenda_diaria
FOR UPDATE TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Supervisor', 'CEO', 'Admin', 'Admin Master', 'Trade'])
  ))
  OR (promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid()))
  OR (promotor_id = auth.uid())
)
WITH CHECK (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Supervisor', 'CEO', 'Admin', 'Admin Master', 'Trade'])
  ))
  OR (promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid()))
  OR (promotor_id = auth.uid())
);

CREATE POLICY "cm_promotor_agenda_diaria_delete_auth" ON public.cm_promotor_agenda_diaria
FOR DELETE TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Supervisor', 'CEO', 'Admin', 'Admin Master', 'Trade'])
  ))
  OR (promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid()))
  OR (promotor_id = auth.uid())
);

-- 5.3 network_matrix
CREATE POLICY "network_matrix_select_auth" ON public.network_matrix
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "network_matrix_manage_auth" ON public.network_matrix
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

-- 5.4 base_atendimento
CREATE POLICY "base_atendimento_select_auth" ON public.base_atendimento
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "base_atendimento_manage_auth" ON public.base_atendimento
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade'])
  )
);

-- 5.5 pdvs
CREATE POLICY "pdvs_select_auth" ON public.pdvs
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "pdvs_manage_auth" ON public.pdvs
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  )
);

-- 5.6 sales_v2 & targets
CREATE POLICY "sales_v2_select_auth" ON public.sales_v2
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "sales_v2_manage_auth" ON public.sales_v2
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

CREATE POLICY "targets_select_auth" ON public.targets
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "targets_manage_auth" ON public.targets
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade'])
  )
);

-- 5.7 cm_skus_conversao
CREATE POLICY "cm_skus_conversao_select_auth" ON public.cm_skus_conversao
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "cm_skus_conversao_manage_auth" ON public.cm_skus_conversao
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro'])
  )
);

-- 5.8 cm_rps_custom_carteira
CREATE POLICY "cm_rps_custom_carteira_select_auth" ON public.cm_rps_custom_carteira
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "cm_rps_custom_carteira_manage_auth" ON public.cm_rps_custom_carteira
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Gerente Nacional', 'Gerente Regional', 'Trade'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Gerente Nacional', 'Gerente Regional', 'Trade'])
  )
);

-- 5.9 cm_faturamento_staging & cm_mv_refresh_jobs & cm_dre_rede_aliases
CREATE POLICY "cm_faturamento_staging_select_auth" ON public.cm_faturamento_staging
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro', 'Diretor'])
  )
);

CREATE POLICY "cm_mv_refresh_jobs_select_auth" ON public.cm_mv_refresh_jobs
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro', 'Diretor'])
  )
);

CREATE POLICY "cm_dre_rede_aliases_select_auth" ON public.cm_dre_rede_aliases
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles WHERE approved = true
  )
);

CREATE POLICY "cm_dre_rede_aliases_manage_auth" ON public.cm_dre_rede_aliases
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro'])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro'])
  )
);

-- 5.10 cm_ai_shelf_analysis & cm_ai_price_analysis & cm_ai_price_analysis_item
CREATE POLICY "cm_ai_shelf_analysis_select_auth" ON public.cm_ai_shelf_analysis
FOR SELECT TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor', 'Gerente Nacional', 'Diretor'])
  ))
  OR (visita_id IN (
    SELECT v.id FROM cm_promotor_visita v
    JOIN cm_promotor_agenda_diaria a ON a.id = v.agenda_diaria_id
    WHERE a.promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid())
       OR a.promotor_id = auth.uid()
  ))
);

CREATE POLICY "cm_ai_shelf_analysis_manage_auth" ON public.cm_ai_shelf_analysis
FOR ALL TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
)
WITH CHECK (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
);

CREATE POLICY "cm_ai_price_analysis_select_auth" ON public.cm_ai_price_analysis
FOR SELECT TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor', 'Gerente Nacional', 'Diretor'])
  ))
  OR (visita_id IN (
    SELECT v.id FROM cm_promotor_visita v
    JOIN cm_promotor_agenda_diaria a ON a.id = v.agenda_diaria_id
    WHERE a.promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid())
       OR a.promotor_id = auth.uid()
  ))
);

CREATE POLICY "cm_ai_price_analysis_manage_auth" ON public.cm_ai_price_analysis
FOR ALL TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
)
WITH CHECK (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
);

CREATE POLICY "cm_ai_price_analysis_item_select_auth" ON public.cm_ai_price_analysis_item
FOR SELECT TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor', 'Gerente Nacional', 'Diretor'])
  ))
  OR (price_analysis_id IN (
    SELECT pa.id FROM cm_ai_price_analysis pa
    JOIN cm_promotor_visita v ON v.id = pa.visita_id
    JOIN cm_promotor_agenda_diaria a ON a.id = v.agenda_diaria_id
    WHERE a.promotor_id = (SELECT employee_id FROM cm_promotor_perfil WHERE user_id = auth.uid())
       OR a.promotor_id = auth.uid()
  ))
);

CREATE POLICY "cm_ai_price_analysis_item_manage_auth" ON public.cm_ai_price_analysis_item
FOR ALL TO authenticated
USING (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
)
WITH CHECK (
  (auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Supervisor'])
  ))
);
