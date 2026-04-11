CREATE OR REPLACE FUNCTION execute_readonly_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  result JSONB;
  clean_query TEXT;
BEGIN
  clean_query := UPPER(TRIM(query_text));
  
  IF NOT (clean_query LIKE 'SELECT%') THEN
    RAISE EXCEPTION 'Apenas consultas SELECT sao permitidas';
  END IF;
  
  IF clean_query LIKE '%DELETE%' OR clean_query LIKE '%UPDATE%' 
     OR clean_query LIKE '%INSERT%' OR clean_query LIKE '%DROP%' 
     OR clean_query LIKE '%ALTER%' OR clean_query LIKE '%TRUNCATE%' THEN
    RAISE EXCEPTION 'Operacoes de modificacao nao sao permitidas';
  END IF;

  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', query_text)
    INTO result;
  
  RETURN result;
END;
$fn$;
