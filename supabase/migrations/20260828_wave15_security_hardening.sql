-- ==============================================================================
-- COFFEE++ WAVE 15 SECURITY HARDENING MIGRATION
-- Baseline: 92124874e83862c96fb195d6feb529b367e162fd
-- Data: 28/08/2026
-- ==============================================================================

-- 1. HARDENING: cm_clientes
ALTER TABLE public.cm_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_clientes;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_clientes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cm_clientes;

CREATE POLICY "cm_clientes_select_auth" ON public.cm_clientes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cm_clientes_insert_auth" ON public.cm_clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  );

CREATE POLICY "cm_clientes_update_auth" ON public.cm_clientes
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  );

-- 2. HARDENING: cm_boletos
ALTER TABLE public.cm_boletos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert access for all users" ON public.cm_boletos;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.cm_boletos;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cm_boletos;

CREATE POLICY "cm_boletos_select_auth" ON public.cm_boletos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cm_boletos_insert_auth" ON public.cm_boletos
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  );

CREATE POLICY "cm_boletos_update_auth" ON public.cm_boletos
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro', 'Trade', 'CEO'])
    )
  );

CREATE POLICY "cm_boletos_delete_auth" ON public.cm_boletos
  FOR DELETE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master'])
    )
  );

-- 3. HARDENING: upload_batches (Fechar policies anon)
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert" ON public.upload_batches;
DROP POLICY IF EXISTS "anon_update" ON public.upload_batches;
DROP POLICY IF EXISTS "anon_read_all" ON public.upload_batches;

CREATE POLICY "upload_batches_select_admin" ON public.upload_batches
  FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  );

CREATE POLICY "upload_batches_write_admin" ON public.upload_batches
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'CEO'])
    )
  );

-- 4. HARDENING: cm_client_alerts
ALTER TABLE public.cm_client_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.cm_client_alerts;
DROP POLICY IF EXISTS "Enable read for all authenticated users" ON public.cm_client_alerts;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON public.cm_client_alerts;

CREATE POLICY "cm_client_alerts_select_auth" ON public.cm_client_alerts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cm_client_alerts_insert_auth" ON public.cm_client_alerts
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "cm_client_alerts_update_auth" ON public.cm_client_alerts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'Supervisor', 'Gerente Regional', 'CEO'])
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'Supervisor', 'Gerente Regional', 'CEO'])
    )
  );

-- 5. HARDENING: storage.objects para comprovantes_investimento, logos-redes e cartas-anuencia

-- 5.1 Comprovantes Investimento
DROP POLICY IF EXISTS "Allow authenticated deletes from comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from comprovantes" ON storage.objects;

CREATE POLICY "comprovantes_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes_investimento'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO', 'Diretor', 'Gerente Regional', 'Supervisor'])
    )
  );

CREATE POLICY "comprovantes_insert_auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes_investimento'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'Gerente Regional', 'Supervisor', 'CEO'])
    )
  );

CREATE POLICY "comprovantes_update_auth" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovantes_investimento'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO'])
    )
  )
  WITH CHECK (
    bucket_id = 'comprovantes_investimento'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO'])
    )
  );

CREATE POLICY "comprovantes_delete_auth" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes_investimento'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Financeiro'])
    )
  );

-- 5.2 Logos Redes
DROP POLICY IF EXISTS "logos_redes_storage_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_public_select" ON storage.objects;

CREATE POLICY "logos_redes_storage_public_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos-redes');

CREATE POLICY "logos_redes_storage_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos-redes'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'CEO'])
    )
  );

CREATE POLICY "logos_redes_storage_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos-redes'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'CEO'])
    )
  )
  WITH CHECK (
    bucket_id = 'logos-redes'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'CEO'])
    )
  );

CREATE POLICY "logos_redes_storage_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos-redes'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master'])
    )
  );

-- 5.3 Cartas Anuencia (Privado / Gestores)
DROP POLICY IF EXISTS "cartas_anuencia_storage_public_select" ON storage.objects;
DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_update" ON storage.objects;

CREATE POLICY "cartas_anuencia_storage_select_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cartas-anuencia'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO', 'Diretor', 'Gerente Regional'])
    )
  );

CREATE POLICY "cartas_anuencia_storage_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cartas-anuencia'
    AND auth.uid() IN (
      SELECT id FROM public.cm_user_profiles
      WHERE role = ANY (ARRAY['Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO'])
    )
  );
