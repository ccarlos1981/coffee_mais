-- Migration: 20260728_fix_promover_lote_faturamento_cursor.sql
-- Description: Corrige o bug "function max(uuid) does not exist" na RPC promover_lote_faturamento utilizando ordenacao escalar descendente em memoria sobre o CTE do chunk.

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

  WITH lote_promovido AS (
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
      vlr_total_st, cod_cr, centro_resultado, COALESCE(valor_venda_futura, 0)
    FROM public.cm_faturamento_staging
    WHERE batch_id = p_batch_id::uuid
      AND id > p_last_id
    ORDER BY id ASC
    LIMIT p_limit
    RETURNING id
  )
  SELECT 
    COUNT(*), 
    (SELECT id FROM lote_promovido ORDER BY id DESC LIMIT 1)
  INTO v_rows_inserted, v_last_id
  FROM lote_promovido;

  RETURN jsonb_build_object(
    'inserted', COALESCE(v_rows_inserted, 0),
    'last_id', COALESCE(v_last_id, p_last_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.promover_lote_faturamento(text, uuid, integer) TO anon, authenticated, service_role;
