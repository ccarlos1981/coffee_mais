-- Migration: 20260721_venda_entrega_futura.sql
-- Description: Adiciona o campo valor_venda_futura nas tabelas de faturamento, atualiza RPCs de promoção e views agregadas para o Dashboard.

-- 1. Alterar cm_faturamento_staging e cm_faturamento para adicionar valor_venda_futura
ALTER TABLE public.cm_faturamento_staging 
ADD COLUMN IF NOT EXISTS valor_venda_futura NUMERIC DEFAULT 0;

ALTER TABLE public.cm_faturamento 
ADD COLUMN IF NOT EXISTS valor_venda_futura NUMERIC DEFAULT 0;

-- 2. Atualizar a view de retrocompatibilidade cm_faturamento_sankhya
CREATE OR REPLACE VIEW public.cm_faturamento_sankhya AS 
SELECT 
    id,
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
    centro_resultado,
    created_at,
    updated_at,
    chave_bq,
    valor_venda_futura
FROM public.cm_faturamento;

-- 3. Atualizar a RPC promover_lote_faturamento (suportando p_batch_id text)
CREATE OR REPLACE FUNCTION public.promover_lote_faturamento(p_batch_id text, p_offset integer, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 AS $function$
DECLARE
  v_rows_inserted integer := 0;
BEGIN
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

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
  FROM (
    SELECT *
    FROM public.cm_faturamento_staging
    WHERE batch_id = p_batch_id::uuid
    ORDER BY id
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RETURN v_rows_inserted;
END;
$function$;



-- 4. Recriar mv_vendas_agg (Materialized View base com valor_venda_futura)
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_agg CASCADE;

CREATE MATERIALIZED VIEW public.mv_vendas_agg AS
WITH sales_base AS (
  SELECT 
    substring(f.dt_faturamento::text, 1, 7) AS mes,
    substring(f.dt_faturamento::text, 1, 4) AS ano,
    (EXTRACT(month FROM f.dt_faturamento))::integer AS mes_num,
    f.cod_parceiro,
    f.nome_parceiro,
    f.desc_produto AS product,
    CASE
      WHEN (POSITION(('1KG'::text) IN (upper(f.desc_produto))) > 0) THEN '1 KG'::text
      WHEN ((POSITION(('5KG'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('5 KG'::text) IN (upper(f.desc_produto))) > 0)) THEN '5 KG'::text
      WHEN ((POSITION(('CAPSULA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('CÁPSULA'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Cápsula'::text
      WHEN (POSITION(('DRIP'::text) IN (upper(f.desc_produto))) > 0) THEN 'Drip'::text
      WHEN (POSITION(('GEISHA'::text) IN (upper(f.desc_produto))) > 0) THEN 'Geisha'::text
      WHEN (POSITION(('VERDE'::text) IN (upper(f.desc_produto))) > 0) THEN 'Café Verde'::text
      WHEN ((POSITION(('GRAO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('GRÃO'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Grão'::text
      WHEN ((POSITION(('MOIDO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('MOÍDO'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Moído'::text
      WHEN ((POSITION(('ACESSORIO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('GARRAFA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('CANECA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('KIT'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Acessório'::text
      ELSE 'Outros'::text
    END AS tipo_produto,
    f.nome_vendedor,
    f.cod_top,
    CASE
      WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, 0)))
      ELSE COALESCE(f.vlr_total_liq, 0)
    END AS net_value,
    CASE
      WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, 0)))
      ELSE COALESCE(f.quantidade, 0)
    END AS quantity,
    CASE
      WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, 0) +
      CASE
        WHEN (COALESCE(f.vlr_total_st, 0) >= abs(COALESCE(f.vlr_total_liq, 0))) THEN 0
        ELSE COALESCE(f.vlr_total_st, 0)
      END)))
      ELSE (COALESCE(f.custo_icms, 0) +
      CASE
        WHEN (COALESCE(f.vlr_total_st, 0) >= abs(COALESCE(f.vlr_total_liq, 0))) THEN 0
        ELSE COALESCE(f.vlr_total_st, 0)
      END)
    END AS imposto,
    CASE
      WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, 0)))
      ELSE COALESCE(f.custo_total, 0)
    END AS custo_total,
    CASE
      WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_frete, 0)))
      ELSE COALESCE(f.vlr_frete, 0)
    END AS custo_frete,
    COALESCE(f.valor_venda_futura, 0) AS valor_venda_futura
  FROM public.cm_faturamento_sankhya f
  WHERE f.dt_faturamento IS NOT NULL
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text)
    AND f.nome_parceiro <> 'CAFE UTAM S/A'::text
    AND f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text
    AND (
      (
        f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
        AND f.cod_top::numeric = ANY (ARRAY[1100, 1200, 1201, 1723, 1117, 1703])
      )
      OR
      (
        f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
        AND f.cod_top::numeric = ANY (ARRAY[1100, 1200, 1201, 1713, 1117, 1703])
      )
    )
)
SELECT 
  mes,
  ano,
  mes_num,
  cod_parceiro,
  nome_parceiro,
  product,
  tipo_produto,
  nome_vendedor,
  cod_top,
  SUM(net_value) AS net_value,
  SUM(quantity) AS quantity,
  SUM(imposto) AS imposto,
  SUM(custo_total) AS custo_total,
  SUM(custo_frete) AS custo_frete,
  SUM(valor_venda_futura) AS valor_venda_futura,
  COUNT(*) AS num_vendas
FROM sales_base
GROUP BY mes, ano, mes_num, cod_parceiro, nome_parceiro, product, tipo_produto, nome_vendedor, cod_top;

CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_agg_uidx 
ON public.mv_vendas_agg (mes, cod_parceiro, product, cod_top, nome_vendedor);

-- 5. Recriar mv_vendas_mensal como VIEW dinâmica
CREATE OR REPLACE VIEW public.mv_vendas_mensal AS
SELECT 
  v.mes,
  v.ano,
  v.mes_num,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      ELSE c.manager_id
    END, '9999'::text) AS manager_id,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.matriz
    END, v.nome_parceiro, 'Não Mapeado'::text) AS rede,
  v.tipo_produto,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
      ELSE c.uf
    END, 'SP'::text) AS uf,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.tipo_parceiro
    END, 'Outros'::text) AS channel,
  SUM(v.net_value) AS fat,
  SUM(v.quantity) AS qty,
  SUM(v.net_value - v.imposto - v.custo_total - v.custo_frete) AS maco,
  SUM(v.imposto) AS total_imposto,
  SUM(v.custo_total) AS total_custo,
  SUM(v.custo_frete) AS total_frete,
  SUM(v.valor_venda_futura) AS valor_venda_futura,
  SUM(v.num_vendas) AS num_vendas,
  COUNT(DISTINCT v.nome_parceiro) AS clientes_distintos,
  COUNT(DISTINCT v.product) AS skus_distintos,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text) AS manager
FROM public.mv_vendas_agg v
LEFT JOIN public.cm_clientes c ON c.codigo = v.cod_parceiro::integer
WHERE NOT (
  v.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
  AND COALESCE(c.responsavel, 'SEM RESPONSÁVEL') = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text])
)
GROUP BY 
  v.mes, 
  v.ano, 
  v.mes_num, 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      ELSE c.manager_id
    END, '9999'::text), 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.matriz
    END, v.nome_parceiro, 'Não Mapeado'::text), 
  v.tipo_produto, 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
      ELSE c.uf
    END, 'SP'::text),
  CASE
    WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
    WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
    WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
    WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
    ELSE c.tipo_parceiro
  END,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text);

-- 6. Recriar mv_vendas_cliente_mensal como VIEW dinâmica
CREATE OR REPLACE VIEW public.mv_vendas_cliente_mensal AS
SELECT 
  v.mes,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      ELSE c.manager_id
    END, '9999'::text) AS manager_id,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.matriz
    END, v.nome_parceiro, 'Não Mapeado'::text) AS rede,
  v.nome_parceiro,
  v.tipo_produto,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
      ELSE c.uf
    END, 'SP'::text) AS uf,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.tipo_parceiro
    END, 'Outros'::text) AS channel,
  SUM(v.net_value) AS fat,
  SUM(v.quantity) AS qty,
  SUM(v.net_value - v.imposto - v.custo_total - v.custo_frete) AS maco,
  SUM(v.valor_venda_futura) AS valor_venda_futura,
  SUM(v.num_vendas) AS num_vendas,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text) AS manager
FROM public.mv_vendas_agg v
LEFT JOIN public.cm_clientes c ON c.codigo = v.cod_parceiro::integer
WHERE NOT (
  v.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])
  AND COALESCE(c.responsavel, 'SEM RESPONSÁVEL') = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text])
)
GROUP BY 
  v.mes, 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      ELSE c.manager_id
    END, '9999'::text), 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.matriz
    END, v.nome_parceiro, 'Não Mapeado'::text), 
  v.nome_parceiro,
  v.tipo_produto, 
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
      ELSE c.uf
    END, 'SP'::text),
  CASE
    WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
    WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
    WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
    WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
    ELSE c.tipo_parceiro
  END,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text);

-- 7. Permissões de Leitura
GRANT SELECT ON public.mv_vendas_agg TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_mensal TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_cliente_mensal TO anon, authenticated, service_role;
