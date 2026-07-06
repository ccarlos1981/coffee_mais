-- Function to execute Excel staging promotion to production in a single database transaction
CREATE OR REPLACE FUNCTION confirmar_importacao_faturamento(p_batch_id uuid, p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start date;
  v_period_end date;
  v_rows_promoted integer := 0;
  v_log_source text;
BEGIN
  -- 1. Obter informações do log
  SELECT period_start, period_end, source 
  INTO v_period_start, v_period_end, v_log_source
  FROM cm_sync_logs
  WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação não encontrado.';
  END IF;

  -- 2. Se o modo for 'replace', deletar registros oficiais para os meses inteiros correspondentes ao período importado
  IF p_mode = 'replace' AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL THEN
    DELETE FROM cm_faturamento 
    WHERE dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date;
  END IF;

  -- 3. Promover registros da tabela staging para a tabela oficial
  INSERT INTO cm_faturamento (
    origem,
    batch_id,
    cod_cfop,
    cfop_desc,
    dt_faturamento,
    nro_unico,
    nro_nota,
    cod_parceiro,
    nome_parceiro,
    cod_produto,
    desc_produto,
    quantidade,
    vlr_unitario,
    vlr_desconto,
    vlr_total_liq,
    cod_top,
    desc_top,
    custo_icms,
    cod_vendedor,
    nome_vendedor,
    controle,
    custo_total,
    cod_natureza,
    desc_natureza,
    status_nfe,
    vlr_frete,
    vlr_substituicao,
    vlr_total_st,
    cod_cr,
    centro_resultado
  )
  SELECT 
    'EXCEL',
    p_batch_id,
    cod_cfop,
    cfop_desc,
    dt_faturamento,
    nro_unico,
    nro_nota,
    cod_parceiro,
    nome_parceiro,
    cod_produto,
    desc_produto,
    quantidade,
    vlr_unitario,
    vlr_desconto,
    vlr_total_liq,
    cod_top,
    desc_top,
    custo_icms,
    cod_vendedor,
    nome_vendedor,
    controle,
    custo_total,
    cod_natureza,
    desc_natureza,
    status_nfe,
    vlr_frete,
    vlr_substituicao,
    vlr_total_st,
    cod_cr,
    centro_resultado
  FROM cm_faturamento_staging
  WHERE batch_id = p_batch_id;

  GET DIAGNOSTICS v_rows_promoted = ROW_COUNT;

  -- 4. Deletar registros da staging
  DELETE FROM cm_faturamento_staging
  WHERE batch_id = p_batch_id;

  -- 5. Atualizar log para SUCCESS
  UPDATE cm_sync_logs
  SET 
    status = 'SUCCESS',
    finished_at = now(),
    rows_inserted = v_rows_promoted,
    rows_fetched = v_rows_promoted
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'success', true,
    'rowsPromoted', v_rows_promoted
  );
EXCEPTION WHEN OTHERS THEN
  -- O PostgreSQL faz rollback automático de toda a transação da função se um erro ocorrer
  RAISE;
END;
$$;
