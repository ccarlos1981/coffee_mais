-- Migration: 20260804_fix_promover_lote_staging_cursor.sql
-- Description: Corrige o cursor da RPC promover_lote_faturamento para retornar o MAX(id) da tabela de STAGING (cm_faturamento_staging) em vez do ID aleatorio gerado em cm_faturamento.

CREATE OR REPLACE FUNCTION public.promover_lote_faturamento(
  p_batch_id text,
  p_last_id uuid,
  p_limit integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted integer := 0;
  v_last_id uuid;
BEGIN
  -- Ativar o bypass de triggers de faturamento para esta transação (substitui ALTER TABLE e remove locks)
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- 1. Selecionar o chunk da staging ordenado por id ASC
  WITH lote_staging AS (
    SELECT 
      id AS staging_id,
      cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
      cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
      vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
      custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
      cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
      vlr_total_st, cod_cr, centro_resultado, COALESCE(valor_venda_futura, 0) AS valor_venda_futura
    FROM public.cm_faturamento_staging
    WHERE batch_id = p_batch_id::uuid
      AND id > p_last_id
    ORDER BY id ASC
    LIMIT p_limit
  ),
  -- 2. Promover o chunk selecionado para cm_faturamento
  lote_promovido AS (
    INSERT INTO public.cm_faturamento (
      origem, batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
      cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
      vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
      custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
      cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
      vlr_total_st, cod_cr, centro_resultado, valor_venda_futura
    )
    SELECT 
      'EXCEL', p_batch_id::uuid, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
      cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
      vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
      custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
      cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
      vlr_total_st, cod_cr, centro_resultado, valor_venda_futura
    FROM lote_staging
    RETURNING 1
  )
  SELECT 
    COUNT(*), 
    (SELECT staging_id FROM lote_staging ORDER BY staging_id DESC LIMIT 1)
  INTO v_rows_inserted, v_last_id
  FROM lote_promovido;

  RETURN jsonb_build_object(
    'inserted', COALESCE(v_rows_inserted, 0),
    'last_id', COALESCE(v_last_id, p_last_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promover_lote_faturamento(text, uuid, integer) TO anon, authenticated, service_role;
