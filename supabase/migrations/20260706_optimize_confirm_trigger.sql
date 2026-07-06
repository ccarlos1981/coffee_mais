-- Optimize confirmar_importacao_faturamento to disable triggers and perform bulk updates only on base_atendimento partners
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

  -- Desativar triggers temporariamente para evitar o gargalo linha-a-linha do recálculo de faturamento
  ALTER TABLE cm_faturamento DISABLE TRIGGER USER;

  -- Criar tabela temporária com a lista de parceiros afetados que existem na base_atendimento
  CREATE TEMP TABLE affected_partners_temp ON COMMIT DROP AS
  SELECT DISTINCT cod_parceiro 
  FROM (
    SELECT DISTINCT cod_parceiro 
    FROM cm_faturamento 
    WHERE p_mode = 'replace' 
      AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL
      AND dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date
      AND cod_parceiro IS NOT NULL
    UNION
    SELECT DISTINCT cod_parceiro 
    FROM cm_faturamento_staging 
    WHERE batch_id = p_batch_id
      AND cod_parceiro IS NOT NULL
  ) t
  WHERE cod_parceiro IN (SELECT cod_parceiro FROM public.base_atendimento);

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

  -- Reativar triggers
  ALTER TABLE cm_faturamento ENABLE TRIGGER USER;

  -- 5. Atualizar a base_atendimento em lote de forma extremamente otimizada para os parceiros afetados
  UPDATE public.base_atendimento b
  SET faturamento_mensal = COALESCE(s.avg_total_mes, 0.00)
  FROM (
    WITH partner_monthly_sums AS (
      SELECT
        cod_parceiro,
        SUM(vlr_total_liq) as total_mes
      FROM public.cm_faturamento
      WHERE cod_parceiro IN (SELECT cod_parceiro FROM affected_partners_temp)
        AND dt_faturamento < date_trunc('month', CURRENT_DATE)
      GROUP BY cod_parceiro, date_trunc('month', dt_faturamento)
    )
    SELECT 
      cod_parceiro, 
      AVG(total_mes) as avg_total_mes 
    FROM partner_monthly_sums
    GROUP BY cod_parceiro
  ) s
  WHERE b.cod_parceiro = s.cod_parceiro;

  -- 6. Atualizar log para SUCCESS
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
  ALTER TABLE cm_faturamento ENABLE TRIGGER USER;
  RAISE;
END;
$$;
