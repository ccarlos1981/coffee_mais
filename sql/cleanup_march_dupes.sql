-- Remover duplicatas de março do batch antigo (dados3.xlsx)
-- que já foram reimportadas pelo arquivo.xls

-- Função temporária com SECURITY DEFINER para conseguir deletar
CREATE OR REPLACE FUNCTION cleanup_old_march_dupes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rows_deleted integer;
BEGIN
  WITH deleted AS (
    DELETE FROM sales
    WHERE upload_batch_id = '444c388b-5cdc-4aaf-b841-89c72d60644b'
      AND invoice_date >= '2026-03-02'
      AND invoice_date <= '2026-04-01'
    RETURNING 1
  )
  SELECT count(*) INTO rows_deleted FROM deleted;
  
  RETURN rows_deleted;
END;
$$;

-- Executar
SELECT cleanup_old_march_dupes();

-- Limpar função temporária
DROP FUNCTION cleanup_old_march_dupes();
