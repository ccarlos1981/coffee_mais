-- =============================================================================
-- Migration Oficial: Sincronização de Redes Matrizes com network_matrix (FK Guard)
-- Data: 2026-08-25
-- Escopo: public.network_matrix (População a partir de cm_redes_matrizes)
-- =============================================================================

DO $$
DECLARE
  v_inserted INT;
BEGIN
  -- Inserir redes ativas de cm_redes_matrizes que ainda não constam em network_matrix
  WITH inserted_rows AS (
    INSERT INTO public.network_matrix (network, network_uf, manager, manager_id, region)
    SELECT DISTINCT ON (UPPER(TRIM(rm.nome)))
      rm.nome as network,
      rm.nome || COALESCE(' - ' || rm.canal, '') as network_uf,
      rm.manager,
      COALESCE(rm.manager_id, '9999') as manager_id,
      'Sudeste' as region
    FROM public.cm_redes_matrizes rm
    WHERE NOT EXISTS (
      SELECT 1 FROM public.network_matrix nm 
      WHERE UPPER(TRIM(nm.network)) = UPPER(TRIM(rm.nome))
    )
    ORDER BY UPPER(TRIM(rm.nome)), rm.codigo
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM inserted_rows;

  RAISE NOTICE 'Sincronização de network_matrix concluída: % novas redes inseridas.', v_inserted;
END $$;
