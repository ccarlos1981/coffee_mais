-- ============================================================================
-- WAVE 6 — POST-WAVE 5 DATABASE RLS HARDENING & PRIVILEGE REFINEMENT
-- Data: 2026-08-27
-- Objetivo: Ativar RLS e criar policies restritas para tabelas de backup/jobs
--           e refinar policies de business_days, cm_acoes_boletos_vinculo,
--           cm_trade_calendario_anual.
-- ============================================================================

-- 1. ATIVAR RLS NAS 8 TABELAS DE BACKUP / JOBS / STAGING RESIDUAIS
ALTER TABLE public.cm_acoes_investimento_migradas_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_audit_commercial_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_clientes_atividade_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_clientes_backup_20260719 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_import_affected_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_investimento_familias_migradas_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_migration_sprint3_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_weekly_projections_workflow ENABLE ROW LEVEL SECURITY;

-- 2. REVOGAR PRIVILÉGIOS DE ACESSO DIRETO DA ROLE ANON
REVOKE ALL ON public.cm_acoes_investimento_migradas_backup FROM anon;
REVOKE ALL ON public.cm_audit_commercial_attempts FROM anon;
REVOKE ALL ON public.cm_clientes_atividade_jobs FROM anon;
REVOKE ALL ON public.cm_clientes_backup_20260719 FROM anon;
REVOKE ALL ON public.cm_import_affected_partners FROM anon;
REVOKE ALL ON public.cm_investimento_familias_migradas_backup FROM anon;
REVOKE ALL ON public.cm_migration_sprint3_mapping FROM anon;
REVOKE ALL ON public.cm_weekly_projections_workflow FROM anon;

REVOKE ALL ON public.business_days FROM anon;
REVOKE ALL ON public.cm_acoes_boletos_vinculo FROM anon;
REVOKE ALL ON public.cm_trade_calendario_anual FROM anon;

-- 3. DROPAR POLICIES PÚBLICAS OU INSEGURAS EM TABELAS SECUNDÁRIAS
DROP POLICY IF EXISTS "anon_read_all" ON public.business_days;
DROP POLICY IF EXISTS "anon_insert" ON public.business_days;
DROP POLICY IF EXISTS "anon_update" ON public.business_days;
DROP POLICY IF EXISTS "authenticated_read_all" ON public.business_days;
DROP POLICY IF EXISTS "authenticated_insert" ON public.business_days;
DROP POLICY IF EXISTS "authenticated_update" ON public.business_days;
DROP POLICY IF EXISTS "authenticated_delete" ON public.business_days;
DROP POLICY IF EXISTS "business_days_select_auth" ON public.business_days;
DROP POLICY IF EXISTS "business_days_manage_auth" ON public.business_days;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.cm_acoes_boletos_vinculo;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_acoes_boletos_vinculo;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_acoes_boletos_vinculo;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.cm_acoes_boletos_vinculo;
DROP POLICY IF EXISTS "cm_acoes_boletos_vinculo_select_auth" ON public.cm_acoes_boletos_vinculo;
DROP POLICY IF EXISTS "cm_acoes_boletos_vinculo_manage_auth" ON public.cm_acoes_boletos_vinculo;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.cm_trade_calendario_anual;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_trade_calendario_anual;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_trade_calendario_anual;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.cm_trade_calendario_anual;
DROP POLICY IF EXISTS "cm_trade_calendario_anual_select_auth" ON public.cm_trade_calendario_anual;
DROP POLICY IF EXISTS "cm_trade_calendario_anual_manage_auth" ON public.cm_trade_calendario_anual;

DROP POLICY IF EXISTS "cm_weekly_projections_workflow_select_auth" ON public.cm_weekly_projections_workflow;
DROP POLICY IF EXISTS "cm_weekly_projections_workflow_manage_auth" ON public.cm_weekly_projections_workflow;
DROP POLICY IF EXISTS "cm_clientes_atividade_jobs_manage_auth" ON public.cm_clientes_atividade_jobs;
DROP POLICY IF EXISTS "cm_audit_commercial_attempts_select_auth" ON public.cm_audit_commercial_attempts;
DROP POLICY IF EXISTS "cm_import_affected_partners_select_auth" ON public.cm_import_affected_partners;
DROP POLICY IF EXISTS "cm_backup_tables_select_auth" ON public.cm_clientes_backup_20260719;
DROP POLICY IF EXISTS "cm_backup_inv_select_auth" ON public.cm_acoes_investimento_migradas_backup;
DROP POLICY IF EXISTS "cm_backup_inv_fam_select_auth" ON public.cm_investimento_familias_migradas_backup;
DROP POLICY IF EXISTS "cm_migration_mapping_select_auth" ON public.cm_migration_sprint3_mapping;

-- 4. CRIAR POLICIES RESTRITAS HOMOLOGADAS (WAVE 6)

-- 4.1 business_days
CREATE POLICY "business_days_select_auth" ON public.business_days
FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM cm_user_profiles WHERE approved = true)
);

CREATE POLICY "business_days_manage_auth" ON public.business_days
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

-- 4.2 cm_acoes_boletos_vinculo
CREATE POLICY "cm_acoes_boletos_vinculo_select_auth" ON public.cm_acoes_boletos_vinculo
FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM cm_user_profiles WHERE approved = true)
);

CREATE POLICY "cm_acoes_boletos_vinculo_manage_auth" ON public.cm_acoes_boletos_vinculo
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

-- 4.3 cm_trade_calendario_anual
CREATE POLICY "cm_trade_calendario_anual_select_auth" ON public.cm_trade_calendario_anual
FOR SELECT TO authenticated
USING (
  auth.uid() IN (SELECT id FROM cm_user_profiles WHERE approved = true)
);

CREATE POLICY "cm_trade_calendario_anual_manage_auth" ON public.cm_trade_calendario_anual
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

-- 4.4 cm_weekly_projections_workflow
CREATE POLICY "cm_weekly_projections_workflow_select_auth" ON public.cm_weekly_projections_workflow
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Gerente Nacional', 'Gerente Regional', 'Trade'])
  )
);

CREATE POLICY "cm_weekly_projections_workflow_manage_auth" ON public.cm_weekly_projections_workflow
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

-- 4.5 cm_clientes_atividade_jobs & cm_import_affected_partners & cm_audit_commercial_attempts
CREATE POLICY "cm_clientes_atividade_jobs_manage_auth" ON public.cm_clientes_atividade_jobs
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

CREATE POLICY "cm_import_affected_partners_select_auth" ON public.cm_import_affected_partners
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO', 'Trade', 'Financeiro'])
  )
);

CREATE POLICY "cm_audit_commercial_attempts_select_auth" ON public.cm_audit_commercial_attempts
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

-- 4.6 Tabelas de backup histórico: restritas a Admin/Admin Master/CEO
CREATE POLICY "cm_backup_tables_select_auth" ON public.cm_clientes_backup_20260719
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_backup_inv_select_auth" ON public.cm_acoes_investimento_migradas_backup
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_backup_inv_fam_select_auth" ON public.cm_investimento_familias_migradas_backup
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);

CREATE POLICY "cm_migration_mapping_select_auth" ON public.cm_migration_sprint3_mapping
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM cm_user_profiles
    WHERE approved = true AND role = ANY(ARRAY['Admin', 'Admin Master', 'CEO'])
  )
);
