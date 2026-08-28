-- ====================================================================
-- WAVE 12 — HARDENING DE STORAGE, CARTAS DE ANUÊNCIA E LOGOS DAS REDES
-- Data: 28/08/2026
-- ====================================================================

-- 1. Storage RLS: logos-redes
-- Bloquear escrita para usuários não autorizados (Promotor, etc.)
-- Permitir escrita exclusivamente para Trade, Admin, Admin Master, CEO
DROP POLICY IF EXISTS "logos_redes_storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "logos_redes_storage_write_role" ON storage.objects;

CREATE POLICY "logos_redes_storage_write_role" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'logos-redes' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
)
WITH CHECK (
  bucket_id = 'logos-redes' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

-- Atualizar mime types permitidos no bucket (remover image/svg+xml)
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
WHERE id = 'logos-redes';

-- 2. Storage RLS: cartas-anuencia
-- Bloquear escrita direta para usuários sem role apropriada
DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "cartas_anuencia_storage_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "cartas_anuencia_storage_write_role" ON storage.objects;

CREATE POLICY "cartas_anuencia_storage_write_role" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'cartas-anuencia' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
)
WITH CHECK (
  bucket_id = 'cartas-anuencia' AND
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
);

-- 3. Database RLS: cm_cartas_anuencia (DELETE físico bloqueado / Soft-delete obrigatório)
DROP POLICY IF EXISTS "cm_cartas_anuencia_policy" ON public.cm_cartas_anuencia;
DROP POLICY IF EXISTS "cm_cartas_anuencia_select_auth" ON public.cm_cartas_anuencia;
DROP POLICY IF EXISTS "cm_cartas_anuencia_write_role" ON public.cm_cartas_anuencia;
DROP POLICY IF EXISTS "cm_cartas_anuencia_insert_role" ON public.cm_cartas_anuencia;
DROP POLICY IF EXISTS "cm_cartas_anuencia_update_role" ON public.cm_cartas_anuencia;

CREATE POLICY "cm_cartas_anuencia_select_auth" ON public.cm_cartas_anuencia
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_cartas_anuencia_insert_role" ON public.cm_cartas_anuencia
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
);

CREATE POLICY "cm_cartas_anuencia_update_role" ON public.cm_cartas_anuencia
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
);

-- 4. Database RLS: cm_carta_anuencia_timeline (100% Append-Only)
DROP POLICY IF EXISTS "cm_carta_anuencia_timeline_policy" ON public.cm_carta_anuencia_timeline;
DROP POLICY IF EXISTS "cm_carta_anuencia_timeline_select_auth" ON public.cm_carta_anuencia_timeline;
DROP POLICY IF EXISTS "cm_carta_anuencia_timeline_insert_role" ON public.cm_carta_anuencia_timeline;

CREATE POLICY "cm_carta_anuencia_timeline_select_auth" ON public.cm_carta_anuencia_timeline
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_carta_anuencia_timeline_insert_role" ON public.cm_carta_anuencia_timeline
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'Financeiro', 'CEO')
  )
);

-- 5. Database RLS: cm_competencias_anuencia & cm_logos_redes
DROP POLICY IF EXISTS "cm_competencias_anuencia_policy" ON public.cm_competencias_anuencia;
DROP POLICY IF EXISTS "cm_competencias_anuencia_select_auth" ON public.cm_competencias_anuencia;
DROP POLICY IF EXISTS "cm_competencias_anuencia_write_role" ON public.cm_competencias_anuencia;
DROP POLICY IF EXISTS "cm_competencias_anuencia_insert_role" ON public.cm_competencias_anuencia;
DROP POLICY IF EXISTS "cm_competencias_anuencia_update_role" ON public.cm_competencias_anuencia;

CREATE POLICY "cm_competencias_anuencia_select_auth" ON public.cm_competencias_anuencia
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_competencias_anuencia_insert_role" ON public.cm_competencias_anuencia
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

CREATE POLICY "cm_competencias_anuencia_update_role" ON public.cm_competencias_anuencia
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

DROP POLICY IF EXISTS "cm_logos_redes_policy" ON public.cm_logos_redes;
DROP POLICY IF EXISTS "cm_logos_redes_select_auth" ON public.cm_logos_redes;
DROP POLICY IF EXISTS "cm_logos_redes_write_role" ON public.cm_logos_redes;
DROP POLICY IF EXISTS "cm_logos_redes_insert_role" ON public.cm_logos_redes;
DROP POLICY IF EXISTS "cm_logos_redes_update_role" ON public.cm_logos_redes;

CREATE POLICY "cm_logos_redes_select_auth" ON public.cm_logos_redes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_logos_redes_insert_role" ON public.cm_logos_redes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

CREATE POLICY "cm_logos_redes_update_role" ON public.cm_logos_redes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

-- 6. Database RLS: cm_logos_redes_historico
DROP POLICY IF EXISTS "cm_logos_redes_historico_policy" ON public.cm_logos_redes_historico;
DROP POLICY IF EXISTS "cm_logos_redes_historico_select_auth" ON public.cm_logos_redes_historico;
DROP POLICY IF EXISTS "cm_logos_redes_historico_insert_role" ON public.cm_logos_redes_historico;
DROP POLICY IF EXISTS "cm_logos_redes_historico_delete_admin" ON public.cm_logos_redes_historico;

CREATE POLICY "cm_logos_redes_historico_select_auth" ON public.cm_logos_redes_historico
FOR SELECT TO authenticated USING (true);

CREATE POLICY "cm_logos_redes_historico_insert_role" ON public.cm_logos_redes_historico
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master', 'Trade', 'CEO')
  )
);

CREATE POLICY "cm_logos_redes_historico_delete_admin" ON public.cm_logos_redes_historico
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cm_user_profiles
    WHERE id = auth.uid() AND approved = true AND role IN ('Admin', 'Admin Master')
  )
);

-- 7. Prevenção Concorrente de TOCTOU na emissão de cartas
CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_cartas_anuencia_rede_comp_versao 
ON public.cm_cartas_anuencia (rede_id, competencia, versao);
