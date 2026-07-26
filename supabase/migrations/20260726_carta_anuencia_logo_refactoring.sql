-- ====================================================================
-- MÓDULO CARTA DE ANUÊNCIA — REFATORAÇÃO DE LOGOS DAS REDES
-- Data: 26/07/2026
-- ====================================================================

-- 1. Provisionar Bucket de Storage 'logos-redes'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'logos-redes', 
    'logos-redes', 
    true, 
    10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

-- Políticas de Storage RLS para logos-redes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'logos_redes_storage_public_select') THEN
        CREATE POLICY logos_redes_storage_public_select ON storage.objects FOR SELECT USING (bucket_id = 'logos-redes');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'logos_redes_storage_auth_insert') THEN
        CREATE POLICY logos_redes_storage_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos-redes');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'logos_redes_storage_auth_update') THEN
        CREATE POLICY logos_redes_storage_auth_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos-redes');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'logos_redes_storage_auth_delete') THEN
        CREATE POLICY logos_redes_storage_auth_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos-redes');
    END IF;
END $$;

-- 2. Enriquecer cm_logos_redes com metadados para auditoria e deduplicação
ALTER TABLE public.cm_logos_redes
    ADD COLUMN IF NOT EXISTS storage_path TEXT NULL,
    ADD COLUMN IF NOT EXISTS hash TEXT NULL,
    ADD COLUMN IF NOT EXISTS mime_type TEXT NULL,
    ADD COLUMN IF NOT EXISTS file_size BIGINT NULL,
    ADD COLUMN IF NOT EXISTS width INT NULL,
    ADD COLUMN IF NOT EXISTS height INT NULL,
    ADD COLUMN IF NOT EXISTS created_by UUID NULL,
    ADD COLUMN IF NOT EXISTS updated_by UUID NULL;

-- Criar índice em storage_path e hash
CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_storage_path ON public.cm_logos_redes(storage_path);
CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_hash ON public.cm_logos_redes(hash);

-- Garantir índice para busca rápida da logo por rede_id
CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_rede_id_v2 ON public.cm_logos_redes(rede_id);

-- 3. Adicionar logo_snapshot_path na tabela cm_cartas_anuencia
ALTER TABLE public.cm_cartas_anuencia
    ADD COLUMN IF NOT EXISTS logo_snapshot_path TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_cm_cartas_anuencia_snapshot_path ON public.cm_cartas_anuencia(logo_snapshot_path);
