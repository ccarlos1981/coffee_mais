-- ============================================================
-- Migration: 20260828_wave16_security_hardening.sql
-- Module: Wave 16 - Database Security & Authorization Hardening
-- Description:
--   1. Hardens RLS on cm_promotor_remuneracao (drops permissive anon policy, creates granular select/mutation policies).
--   2. Hardens RLS on cm_action_notes (drops public anon policies, creates approved-profile select/mutation policies).
--   3. Hardens RLS on cm_processos (drops ALL policy, aligns SELECT with status='PUBLICADO' vs editor roles, restricts mutation to editors).
--   4. Hardens RLS on cm_processos_historico (drops ALL policy, restricts mutation to editors).
--   5. Hardens RLS on cm_processos_leitura (drops ALL policy, restricts insert/update to user's own readings).
-- ============================================================

-- ------------------------------------------------------------
-- 1. cm_promotor_remuneracao
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.cm_promotor_remuneracao;
DROP POLICY IF EXISTS "cm_promotor_remuneracao_select_auth" ON public.cm_promotor_remuneracao;
DROP POLICY IF EXISTS "cm_promotor_remuneracao_mutation_auth" ON public.cm_promotor_remuneracao;

CREATE POLICY "cm_promotor_remuneracao_select_auth" ON public.cm_promotor_remuneracao
FOR SELECT TO authenticated
USING (
  -- 1. National Administrative Roles (Global Scope)
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'Trade', 'RH', 'Financeiro')
  )
  -- 2. Promotor reading self-record
  OR promotor_id = auth.uid()
  OR promotor_id IN (
    SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid()
  )
  -- 3. Supervisor reading assigned team (via direct user_id or employee_id mapping)
  OR promotor_id IN (
    SELECT m.promotor_id FROM public.cm_promotor_supervisor_mapping m
    WHERE m.supervisor_id = auth.uid()
       OR m.supervisor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
  )
  OR promotor_id IN (
    SELECT p.user_id FROM public.cm_promotor_perfil p
    JOIN public.cm_promotor_supervisor_mapping m ON m.promotor_id = p.employee_id
    WHERE m.supervisor_id = auth.uid()
       OR m.supervisor_id IN (SELECT employee_id FROM public.cm_promotor_perfil WHERE user_id = auth.uid())
  )
);

CREATE POLICY "cm_promotor_remuneracao_mutation_auth" ON public.cm_promotor_remuneracao
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'Trade', 'RH', 'Financeiro')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'Trade', 'RH', 'Financeiro')
  )
);

-- ------------------------------------------------------------
-- 2. cm_action_notes
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Enable insert for all authenticated users on actions" ON public.cm_action_notes;
DROP POLICY IF EXISTS "Enable read for all authenticated users on actions" ON public.cm_action_notes;
DROP POLICY IF EXISTS "cm_action_notes_select_auth" ON public.cm_action_notes;
DROP POLICY IF EXISTS "cm_action_notes_insert_auth" ON public.cm_action_notes;
DROP POLICY IF EXISTS "cm_action_notes_mutation_auth" ON public.cm_action_notes;

CREATE POLICY "cm_action_notes_select_auth" ON public.cm_action_notes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_action_notes_insert_auth" ON public.cm_action_notes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() AND p.approved = true
  )
);

CREATE POLICY "cm_action_notes_mutation_auth" ON public.cm_action_notes
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'Trade')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'Trade')
  )
);

-- ------------------------------------------------------------
-- 3. cm_processos
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all authenticated users full access to processes" ON public.cm_processos;
DROP POLICY IF EXISTS "cm_processos_select_auth" ON public.cm_processos;
DROP POLICY IF EXISTS "cm_processos_mutation_auth" ON public.cm_processos;

CREATE POLICY "cm_processos_select_auth" ON public.cm_processos
FOR SELECT TO authenticated
USING (
  ativo = true AND (
    status = 'PUBLICADO'
    OR EXISTS (
      SELECT 1 FROM public.cm_user_profiles p 
      WHERE p.id = auth.uid() 
        AND p.approved = true 
        AND p.role IN ('Admin', 'Admin Master', 'CEO', 'RH', 'TI')
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
);

CREATE POLICY "cm_processos_mutation_auth" ON public.cm_processos
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'RH', 'TI')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'RH', 'TI')
  )
);

-- ------------------------------------------------------------
-- 4. cm_processos_historico
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all authenticated users full access to process history" ON public.cm_processos_historico;
DROP POLICY IF EXISTS "cm_processos_historico_select_auth" ON public.cm_processos_historico;
DROP POLICY IF EXISTS "cm_processos_historico_mutation_auth" ON public.cm_processos_historico;

CREATE POLICY "cm_processos_historico_select_auth" ON public.cm_processos_historico
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
);

CREATE POLICY "cm_processos_historico_mutation_auth" ON public.cm_processos_historico
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'RH', 'TI')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO', 'RH', 'TI')
  )
);

-- ------------------------------------------------------------
-- 5. cm_processos_leitura
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all authenticated users full access to process reading lo" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_select_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_insert_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_update_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_delete_auth" ON public.cm_processos_leitura;

CREATE POLICY "cm_processos_leitura_select_auth" ON public.cm_processos_leitura
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
);

CREATE POLICY "cm_processos_leitura_insert_auth" ON public.cm_processos_leitura
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
);

CREATE POLICY "cm_processos_leitura_update_auth" ON public.cm_processos_leitura
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
)
WITH CHECK (
  user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true
  )
);

CREATE POLICY "cm_processos_leitura_delete_auth" ON public.cm_processos_leitura
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles p 
    WHERE p.id = auth.uid() 
      AND p.approved = true 
      AND p.role IN ('Admin', 'Admin Master', 'CEO')
  )
);
