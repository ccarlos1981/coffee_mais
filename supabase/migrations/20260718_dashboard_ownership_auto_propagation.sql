-- Migration: 20260718_dashboard_ownership_auto_propagation.sql
-- Description: Implementação definitiva da propagação automática de ownership para dashboards.
--              1. Cria a view materializada base public.mv_vendas_agg (faturamento físico agrupado por parceiro).
--              2. Substitui as antigas views materializadas (mv_vendas_mensal, mv_vendas_cliente_mensal, mv_positivacao_sku_mensal)
--                 por Views lógicas dinâmicas normais ligadas diretamente ao Cadastro Único (cm_clientes).
--              3. Atualiza a RPC refresh_materialized_views() para atualizar apenas mv_vendas_agg.
--              4. Limpa as views temporárias vw_ prefixadas de homologação.

-- 1. Remover as views materializadas antigas
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_mensal CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_cliente_mensal CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_positivacao_sku_mensal CASCADE;

-- 2. Remover views temporárias de homologação
DROP VIEW IF EXISTS public.vw_vendas_mensal CASCADE;
DROP VIEW IF EXISTS public.vw_vendas_cliente_mensal CASCADE;
DROP VIEW IF EXISTS public.vw_positivacao_sku_mensal CASCADE;

-- 3. Criar a nova View Materializada base (apenas dados de faturamento/SKU físicos, sem gerência)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_vendas_agg AS
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
    END AS custo_frete
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
  COUNT(*) AS num_vendas
FROM sales_base
GROUP BY mes, ano, mes_num, cod_parceiro, nome_parceiro, product, tipo_produto, nome_vendedor, cod_top;

-- 4. Criar índice de performance para refreshes concorrentes na view materializada base
CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_agg_uidx 
ON public.mv_vendas_agg (mes, cod_parceiro, product, cod_top, nome_vendedor);

-- 5. Recriar mv_vendas_mensal como VIEW dinâmica consumindo de cm_clientes
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

-- 6. Recriar mv_vendas_cliente_mensal como VIEW dinâmica consumindo de cm_clientes
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

-- 7. Recriar mv_positivacao_sku_mensal como VIEW dinâmica consumindo de cm_clientes
CREATE OR REPLACE VIEW public.mv_positivacao_sku_mensal AS
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
    END, 'Não Mapeado'::text) AS rede,
  COALESCE(c.nome_parceiro, v.nome_parceiro) AS nome_parceiro,
  v.product,
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
  SUM(v.quantity) AS qty,
  SUM(v.net_value) AS fat,
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
    END, 'Não Mapeado'::text), 
  COALESCE(c.nome_parceiro, v.nome_parceiro), 
  v.product, 
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

-- 8. Atualizar a RPC de Refresh para apontar exclusivamente para a nova view materializada base
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage text;
  v_stage_start timestamptz;
  v_stage_end timestamptz;
  v_duration interval;
  r RECORD;
BEGIN
  v_stage := '1. refresh mv_vendas_agg';
  v_stage_start := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_agg;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('mv_vendas_agg', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: view_refresh, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;
END;
$function$;

-- 9. Conceder permissões para os novos objetos
GRANT SELECT ON public.mv_vendas_agg TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_mensal TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_cliente_mensal TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_positivacao_sku_mensal TO anon, authenticated, service_role;
