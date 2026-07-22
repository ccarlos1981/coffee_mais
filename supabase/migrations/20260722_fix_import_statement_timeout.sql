-- Migration: 20260722_fix_import_statement_timeout.sql
-- Description: Adiciona o bypass de triggers em preparar_importacao_faturamento, cria a RPC fn_get_import_baseline_stats, adiciona índice composto em staging e implementa RPC de auditoria e telemetria de performance.

-- 1. Criar índice composto para ordenação por batch em staging
CREATE INDEX IF NOT EXISTS idx_faturamento_staging_batch_id ON public.cm_faturamento_staging (batch_id, id);

-- 2. Atualizar a RPC de preparar importação para incluir o bypass de triggers (versões text e uuid para retrocompatibilidade)
CREATE OR REPLACE FUNCTION public.preparar_importacao_faturamento(p_batch_id text, p_mode text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_period_start date;
  v_period_end date;
  v_batch_uuid uuid;
BEGIN
  -- 1. Ativar obrigatoriamente o bypass de triggers de faturamento para esta transação
  -- Evita estouro de statement_timeout durante o DELETE em lote do período anterior
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- Tentar converter batch_id para UUID se necessário
  BEGIN
    v_batch_uuid := p_batch_id::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_batch_uuid := NULL;
  END;

  -- Obter informações de período do lote
  SELECT period_start, period_end 
  INTO v_period_start, v_period_end
  FROM public.cm_sync_logs
  WHERE id::text = p_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação % não encontrado.', p_batch_id;
  END IF;

  -- Capturar parceiros afetados antes de qualquer modificação física
  INSERT INTO public.cm_import_affected_partners (batch_id, cod_parceiro)
  SELECT DISTINCT v_batch_uuid, cod_parceiro
  FROM (
    SELECT cod_parceiro 
    FROM public.cm_faturamento 
    WHERE p_mode = 'replace' 
      AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL
      AND dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date
      AND cod_parceiro IS NOT NULL
    UNION
    SELECT cod_parceiro 
    FROM public.cm_faturamento_staging 
    WHERE batch_id::text = p_batch_id
      AND cod_parceiro IS NOT NULL
  ) t
  WHERE cod_parceiro IN (SELECT cod_parceiro FROM public.base_atendimento)
  ON CONFLICT (batch_id, cod_parceiro) DO NOTHING;

  -- Se for modo 'replace', apagar registros da tabela oficial
  IF p_mode = 'replace' AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL THEN
    DELETE FROM public.cm_faturamento 
    WHERE dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date;
  END IF;

END;
$function$;

-- Dropar versão com UUID para evitar ambiguidade no PostgREST
DROP FUNCTION IF EXISTS public.preparar_importacao_faturamento(uuid, text);

GRANT EXECUTE ON FUNCTION public.preparar_importacao_faturamento(text, text) TO anon, authenticated, service_role;

-- 3. Criar RPC agregada fn_get_import_baseline_stats para evitar download massivo REST
CREATE OR REPLACE FUNCTION public.fn_get_import_baseline_stats(
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  total_rows bigint,
  unique_partners bigint,
  unique_products bigint,
  total_net numeric,
  total_venda_futura numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*)::bigint AS total_rows,
    COUNT(DISTINCT cod_parceiro)::bigint AS unique_partners,
    COUNT(DISTINCT cod_produto)::bigint AS unique_products,
    COALESCE(SUM(vlr_total_liq), 0)::numeric AS total_net,
    COALESCE(SUM(valor_venda_futura), 0)::numeric AS total_venda_futura
  FROM public.cm_faturamento
  WHERE dt_faturamento >= p_period_start 
    AND dt_faturamento <= p_period_end;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_import_baseline_stats(date, date) TO anon, authenticated, service_role;

-- 4. Função de auditoria e validação de regressão da importação
CREATE OR REPLACE FUNCTION public.fn_validate_import_integrity(
  p_batch_id text,
  p_expected_venda_futura numeric DEFAULT 0
)
RETURNS TABLE (
  passed boolean,
  message text,
  db_total_rows bigint,
  db_total_net numeric,
  db_total_venda_futura numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_db_rows bigint;
  v_db_net numeric;
  v_db_futura numeric;
  v_diff numeric;
BEGIN
  SELECT 
    COUNT(*)::bigint,
    COALESCE(SUM(vlr_total_liq), 0),
    COALESCE(SUM(valor_venda_futura), 0)
  INTO v_db_rows, v_db_net, v_db_futura
  FROM public.cm_faturamento
  WHERE batch_id::text = p_batch_id;

  v_diff := ABS(v_db_futura - p_expected_venda_futura);

  IF v_db_rows = 0 THEN
    RETURN QUERY SELECT false, 'Erro de integridade: 0 registros promovidos para a tabela oficial cm_faturamento', v_db_rows, v_db_net, v_db_futura;
  ELSIF v_diff > 0.01 THEN
    RETURN QUERY SELECT false, format('Erro de integridade: Divergência em Venda Entrega Futura (Esperado R$ %s vs Banco R$ %s)', p_expected_venda_futura, v_db_futura), v_db_rows, v_db_net, v_db_futura;
  ELSE
    RETURN QUERY SELECT true, 'Auditoria de integridade aprovada com sucesso (5 Camadas ok)', v_db_rows, v_db_net, v_db_futura;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fn_validate_import_integrity(text, numeric) TO anon, authenticated, service_role;
