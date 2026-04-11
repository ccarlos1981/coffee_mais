-- Garantir que a função está acessível via API
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(TEXT) TO authenticated;

-- Forçar reload do schema do PostgREST
NOTIFY pgrst, 'reload schema';
