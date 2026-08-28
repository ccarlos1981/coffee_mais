-- ============================================================
-- Rollback Migration: 20260828_rollback_wave16_security.sql
-- Module: Wave 16 Rollback Script
-- Description:
--   Rolls back the granular RLS policies created in Wave 16.
-- ============================================================

-- 1. cm_promotor_remuneracao
DROP POLICY IF EXISTS "cm_promotor_remuneracao_select_auth" ON public.cm_promotor_remuneracao;
DROP POLICY IF EXISTS "cm_promotor_remuneracao_mutation_auth" ON public.cm_promotor_remuneracao;

CREATE POLICY "Enable all for authenticated users" ON public.cm_promotor_remuneracao
FOR ALL TO public
USING (((auth.role() = 'authenticated'::text) OR (auth.role() = 'anon'::text)));

-- 2. cm_action_notes
DROP POLICY IF EXISTS "cm_action_notes_select_auth" ON public.cm_action_notes;
DROP POLICY IF EXISTS "cm_action_notes_insert_auth" ON public.cm_action_notes;
DROP POLICY IF EXISTS "cm_action_notes_mutation_auth" ON public.cm_action_notes;

CREATE POLICY "Enable insert for all authenticated users on actions" ON public.cm_action_notes
FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Enable read for all authenticated users on actions" ON public.cm_action_notes
FOR SELECT TO public USING (true);

-- 3. cm_processos
DROP POLICY IF EXISTS "cm_processos_select_auth" ON public.cm_processos;
DROP POLICY IF EXISTS "cm_processos_mutation_auth" ON public.cm_processos;

CREATE POLICY "Allow all authenticated users full access to processes" ON public.cm_processos
FOR ALL TO public USING ((auth.role() = 'authenticated'::text));

-- 4. cm_processos_historico
DROP POLICY IF EXISTS "cm_processos_historico_select_auth" ON public.cm_processos_historico;
DROP POLICY IF EXISTS "cm_processos_historico_mutation_auth" ON public.cm_processos_historico;

CREATE POLICY "Allow all authenticated users full access to process history" ON public.cm_processos_historico
FOR ALL TO public USING ((auth.role() = 'authenticated'::text));

-- 5. cm_processos_leitura
DROP POLICY IF EXISTS "cm_processos_leitura_select_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_insert_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_update_auth" ON public.cm_processos_leitura;
DROP POLICY IF EXISTS "cm_processos_leitura_delete_auth" ON public.cm_processos_leitura;

CREATE POLICY "Allow all authenticated users full access to process reading lo" ON public.cm_processos_leitura
FOR ALL TO public USING ((auth.role() = 'authenticated'::text));
