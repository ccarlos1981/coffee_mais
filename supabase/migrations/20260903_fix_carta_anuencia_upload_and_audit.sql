-- ====================================================================
-- CORREÇÃO DE AUDITORIA E STORAGE: FLUXO DE ANEXAÇÃO DE CARTA DE ANUÊNCIA
-- Data: 03/09/2026
-- ====================================================================

-- 1. Remoção da constraint restritiva cm_audit_logs_action_check
-- A constraint cm_audit_logs_action_check bloqueava inserções de ações legítimas
-- de auditoria vindas do módulo de Carta de Anuência e outros módulos comerciais.
ALTER TABLE public.cm_audit_logs 
  DROP CONSTRAINT IF EXISTS cm_audit_logs_action_check;

-- 2. Storage RLS: cartas-anuencia
-- Garantir permissão de escrita e leitura no bucket para todos os perfis comerciais autorizados
DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "cartas_anuencia_storage_write_role" ON storage.objects;

CREATE POLICY "cartas_anuencia_storage_auth_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cartas-anuencia' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO', 'Diretor', 'Gerente Regional', 'Gerente Nacional', 'TI')
  )
);

DROP POLICY IF EXISTS "cartas_anuencia_storage_select_auth" ON storage.objects;
CREATE POLICY "cartas_anuencia_storage_select_auth" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'cartas-anuencia' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO', 'Diretor', 'Gerente Regional', 'Gerente Nacional', 'TI')
  )
);
