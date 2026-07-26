-- ====================================================================
-- MÓDULO CARTA DE ANUÊNCIA — VERSIONAMENTO DE LOGOS E LIMPEZA SEGURA
-- Data: 26/07/2026
-- ====================================================================

-- 1. Adicionar colunas de versionamento e status em cm_logos_redes
ALTER TABLE public.cm_logos_redes
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ATIVO',
    ADD COLUMN IF NOT EXISTS obsoleta BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS desativada_em TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_obsoleta ON public.cm_logos_redes(obsoleta);
CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_status ON public.cm_logos_redes(status);

-- 2. Função RPC para identificar logos obsoletas órfãs (sem vínculo com cartas já emitidas)
CREATE OR REPLACE FUNCTION public.fn_listar_logos_obsoletas_orfas()
RETURNS TABLE (
    logo_id UUID,
    rede_id TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ,
    desativada_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id AS logo_id,
        l.rede_id,
        l.storage_path,
        l.created_at,
        l.desativada_em
    FROM public.cm_logos_redes l
    WHERE (l.obsoleta = true OR l.status = 'OBSOLETA')
      AND l.storage_path IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM public.cm_cartas_anuencia c 
          WHERE c.logo_snapshot_path = l.storage_path
      );
END;
$$;
