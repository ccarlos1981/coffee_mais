-- Migration: 20260804_barreira_rpc_sum_net.sql
-- Description: Cria RPC dedicada para a Barreira de Integridade calcular
--              SUM(vlr_total_liq) integralmente no PostgreSQL, eliminando
--              o limite de linhas do PostgREST.

CREATE OR REPLACE FUNCTION public.fn_sum_net_by_batch(p_batch_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(vlr_total_liq), 0)
  FROM public.cm_faturamento
  WHERE batch_id = p_batch_id::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.fn_sum_net_by_batch(text) TO anon, authenticated, service_role;
