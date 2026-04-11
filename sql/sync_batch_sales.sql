-- Função otimizada para sincronizar um batch específico
-- Usa SECURITY DEFINER para ignorar RLS

CREATE OR REPLACE FUNCTION sync_batch_sales(p_batch_id UUID) 
RETURNS integer 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  rows_affected integer := 0;
BEGIN
  -- Atualiza manager e channel via pdv_mapping usando cod_parceiro
  WITH updated AS (
    UPDATE sales s
    SET manager = p.manager,
        channel = p.canal
    FROM pdv_mapping p
    WHERE s.upload_batch_id = p_batch_id
      AND s.cod_parceiro = p.cod_parceiro
      AND s.cod_parceiro IS NOT NULL
      AND (s.manager IS DISTINCT FROM p.manager OR s.channel IS DISTINCT FROM p.canal)
    RETURNING 1
  )
  SELECT count(*) INTO rows_affected FROM updated;
  
  RETURN rows_affected;
END;
$$;
