-- Migration: 20260714_create_vw_faturamento_comercial_oficial.sql
-- Description: Cria a view de governança comercial oficial para paridade com o MyMetrics

CREATE OR REPLACE VIEW public.vw_faturamento_comercial_oficial AS
SELECT 
  id,
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
  -- Inversão de sinal para devoluções na quantidade
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(quantidade, 0::numeric))
    ELSE coalesce(quantidade, 0::numeric)
  END as quantidade,
  vlr_unitario,
  vlr_desconto,
  -- Inversão de sinal para devoluções no valor total líquido
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(vlr_total_liq, 0::numeric))
    ELSE coalesce(vlr_total_liq, 0::numeric)
  END as vlr_total_liq,
  cod_top,
  desc_top,
  -- Inversão de sinal para devoluções no imposto/ST
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(custo_icms, 0::numeric))
    ELSE coalesce(custo_icms, 0::numeric)
  END as custo_icms,
  cod_vendedor,
  nome_vendedor,
  controle,
  -- Inversão de sinal para devoluções no custo total
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(custo_total, 0::numeric))
    ELSE coalesce(custo_total, 0::numeric)
  END as custo_total,
  cod_natureza,
  desc_natureza,
  status_nfe,
  -- Inversão de sinal para devoluções no frete
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(vlr_frete, 0::numeric))
    ELSE coalesce(vlr_frete, 0::numeric)
  END as vlr_frete,
  vlr_substituicao,
  -- Inversão de sinal para devoluções no valor total ST
  CASE 
    WHEN cod_top IN ('1200', '1201') THEN -abs(coalesce(vlr_total_st, 0::numeric))
    ELSE coalesce(vlr_total_st, 0::numeric)
  END as vlr_total_st,
  cod_cr,
  centro_resultado,
  created_at,
  updated_at,
  chave_bq
FROM public.cm_faturamento
WHERE (status_nfe IS NULL OR status_nfe <> 'CANCELADA')
  AND cod_parceiro NOT IN ('19587', '1') -- CAFE UTAM S/A e COFFEE MAIS INDUSTRIA DE CAFE LTDA (Sem strings)
  AND cod_top NOT IN ('1701', '1719', '1720', '1117'); -- Exclusão de TOPs não comerciais para paridade comercial MyMetrics
