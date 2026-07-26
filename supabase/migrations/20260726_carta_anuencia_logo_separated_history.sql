-- ====================================================================
-- MÓDULO CARTA DE ANUÊNCIA — SEPARAÇÃO OPERACIONAL E HISTÓRICO DE LOGOS
-- Data: 26/07/2026
-- ====================================================================

DROP FUNCTION IF EXISTS public.fn_listar_logos_obsoletas_orfas();

-- 1. Garantir unicidade física em cm_logos_redes (1 registro por rede_id)
DELETE FROM public.cm_logos_redes a
USING public.cm_logos_redes b
WHERE a.rede_id = b.rede_id AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_logos_redes_rede_id_unique 
ON public.cm_logos_redes (rede_id);

-- 2. Criar a Tabela de Histórico cm_logos_redes_historico
CREATE TABLE IF NOT EXISTS public.cm_logos_redes_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    logo_id UUID NULL REFERENCES public.cm_logos_redes(id) ON DELETE SET NULL,
    rede_id TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    hash TEXT NULL,
    mime_type TEXT NULL,
    file_size BIGINT NULL,
    width INT NULL,
    height INT NULL,
    motivo_alteracao TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NULL
);

CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_historico_rede_id ON public.cm_logos_redes_historico(rede_id);
CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_historico_storage_path ON public.cm_logos_redes_historico(storage_path);

-- RLS para cm_logos_redes_historico
ALTER TABLE public.cm_logos_redes_historico ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cm_logos_redes_historico_policy') THEN
        CREATE POLICY cm_logos_redes_historico_policy ON public.cm_logos_redes_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Atualizar Função RPC de Limpeza Controlada
CREATE OR REPLACE FUNCTION public.fn_listar_logos_obsoletas_orfas()
RETURNS TABLE (
    historico_id UUID,
    rede_id TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id AS historico_id,
        h.rede_id,
        h.storage_path,
        h.created_at
    FROM public.cm_logos_redes_historico h
    WHERE h.storage_path IS NOT NULL
      -- Não é a logo ativa atual da rede
      AND NOT EXISTS (
          SELECT 1 
          FROM public.cm_logos_redes o 
          WHERE o.storage_path = h.storage_path
      )
      -- Não é utilizada como snapshot em nenhuma carta de anuência
      AND NOT EXISTS (
          SELECT 1 
          FROM public.cm_cartas_anuencia c 
          WHERE c.logo_snapshot_path = h.storage_path
      );
END;
$$;
