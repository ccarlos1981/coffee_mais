-- Recriar a função sync_historical_sales com SECURITY DEFINER
-- para que funcione independente do role do chamador (anon, authenticated, etc)

CREATE OR REPLACE FUNCTION sync_historical_sales() 
RETURNS integer 
LANGUAGE plpgsql 
SECURITY DEFINER  -- <-- roda como owner, ignora RLS
AS $$
DECLARE
  rows_affected integer := 0;
  uf_rows integer := 0;
  pdv_rows integer := 0;
BEGIN
  -- Regra 1 (Geral): UFs. Só modifica o que está diferente para não gerar IO inútil.
  WITH updated AS (
    UPDATE sales s
    SET manager = m.manager
    FROM manager_uf_mapping m
    WHERE s.uf = m.uf
      AND (s.manager IS DISTINCT FROM m.manager)
    RETURNING 1
  )
  SELECT count(*) INTO uf_rows FROM updated;

  -- Regra 2 (Específica): PDVs (sobrescreve a regra do UF se houver conflito).
  WITH updated AS (
    UPDATE sales s
    SET manager = p.manager,
        channel = p.canal
    FROM pdv_mapping p
    WHERE s.cod_parceiro = p.cod_parceiro
      AND (s.manager IS DISTINCT FROM p.manager OR s.channel IS DISTINCT FROM p.canal)
    RETURNING 1
  )
  SELECT count(*) INTO pdv_rows FROM updated;
  
  rows_affected := uf_rows + pdv_rows;
  
  -- Retorna o total de modificações feitas nas duas passadas
  RETURN rows_affected;
END;
$$;
