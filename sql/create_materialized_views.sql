-- ============================================================
-- MATERIALIZED VIEWS para Dashboard Coffee++
-- Objetivo: pré-agregar 907k linhas em ~5k-50k resumos
-- ============================================================

-- ============================================================
-- MV 1: mv_vendas_mensal
-- Agregação mensal por TODAS as dimensões de filtro
-- ~5.000 linhas (cobre: Dashboard, Histórico, Sparkline, Meta CIA, Matriz)
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_vendas_mensal CASCADE;

CREATE MATERIALIZED VIEW mv_vendas_mensal AS
WITH sales_enriched AS (
  SELECT 
    SUBSTRING(CAST(f.dt_faturamento AS text), 1, 7) as mes,
    SUBSTRING(CAST(f.dt_faturamento AS text), 1, 4) as ano,
    EXTRACT(MONTH FROM f.dt_faturamento)::int as mes_num,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.manager
      END,
      'Outros'
    ) as manager,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.rede
      END,
      f.nome_parceiro,
      'Não Mapeado'
    ) as rede,
    CASE 
      WHEN UPPER(f.desc_produto) LIKE '%1KG%' THEN '1 KG'
      WHEN UPPER(f.desc_produto) LIKE '%5KG%' OR UPPER(f.desc_produto) LIKE '%5 KG%' THEN '5 KG'
      WHEN UPPER(f.desc_produto) LIKE '%CAPSULA%' OR UPPER(f.desc_produto) LIKE '%CÁPSULA%' THEN 'Cápsula'
      WHEN UPPER(f.desc_produto) LIKE '%DRIP%' THEN 'Drip'
      WHEN UPPER(f.desc_produto) LIKE '%GEISHA%' THEN 'Geisha'
      WHEN UPPER(f.desc_produto) LIKE '%VERDE%' THEN 'Café Verde'
      WHEN UPPER(f.desc_produto) LIKE '%GRAO%' OR UPPER(f.desc_produto) LIKE '%GRÃO%' THEN 'Grão'
      WHEN UPPER(f.desc_produto) LIKE '%MOIDO%' OR UPPER(f.desc_produto) LIKE '%MOÍDO%' THEN 'Moído'
      WHEN UPPER(f.desc_produto) LIKE '%ACESSORIO%' OR UPPER(f.desc_produto) LIKE '%GARRAFA%' OR UPPER(f.desc_produto) LIKE '%CANECA%' OR UPPER(f.desc_produto) LIKE '%KIT%' THEN 'Acessório'
      ELSE 'Outros'
    END as tipo_produto,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'SP'
        ELSE b.uf
      END,
      'SP'
    ) as uf,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.canal
      END,
      'Outros'
    ) as channel,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0))
      ELSE COALESCE(CAST(f.vlr_total_liq AS numeric), 0)
    END as net_value,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.quantidade AS numeric), 0))
      ELSE COALESCE(CAST(f.quantidade AS numeric), 0)
    END as quantity,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0))
      ELSE (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0))
    END as imposto,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.custo_total AS numeric), 0))
      ELSE COALESCE(CAST(f.custo_total AS numeric), 0)
    END as custo_total,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_frete AS numeric), 0))
      ELSE COALESCE(CAST(f.vlr_frete AS numeric), 0)
    END as custo_frete,
    f.nome_parceiro,
    f.desc_produto as product,
    f.cod_top
  FROM cm_faturamento_sankhya f
  LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE f.dt_faturamento IS NOT NULL
    AND (
      (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND f.cod_top::numeric = 1100)
      OR
      (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND b.manager IS NOT NULL AND b.manager NOT IN ('Ecommerce', 'Marketplace'))
    )
)
SELECT
  mes,
  ano,
  mes_num,
  manager,
  rede,
  tipo_produto,
  uf,
  channel,
  SUM(net_value) as fat,
  SUM(quantity) as qty,
  SUM(net_value - imposto - custo_total - custo_frete) as maco,
  SUM(imposto) as total_imposto,
  SUM(custo_total) as total_custo,
  SUM(custo_frete) as total_frete,
  COUNT(*) as num_vendas,
  COUNT(DISTINCT nome_parceiro) as clientes_distintos,
  COUNT(DISTINCT product) as skus_distintos
FROM sales_enriched
GROUP BY mes, ano, mes_num, manager, rede, tipo_produto, uf, channel;

-- Índices para consultas rápidas
CREATE UNIQUE INDEX idx_mv_vendas_mensal_pk ON mv_vendas_mensal (mes, manager, rede, tipo_produto, uf, channel);
CREATE INDEX idx_mv_vendas_mensal_mes ON mv_vendas_mensal (mes);
CREATE INDEX idx_mv_vendas_mensal_ano ON mv_vendas_mensal (ano);
CREATE INDEX idx_mv_vendas_mensal_manager ON mv_vendas_mensal (manager);


-- ============================================================
-- MV 2: mv_vendas_cliente_mensal
-- Clientes/Rede por mês — para ranking, topClients, positivação
-- ~20.000 linhas
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_vendas_cliente_mensal CASCADE;

CREATE MATERIALIZED VIEW mv_vendas_cliente_mensal AS
WITH sales_enriched AS (
  SELECT 
    SUBSTRING(CAST(f.dt_faturamento AS text), 1, 7) as mes,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.manager
      END,
      'Outros'
    ) as manager,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.rede
      END,
      f.nome_parceiro,
      'Não Mapeado'
    ) as rede,
    f.nome_parceiro,
    CASE 
      WHEN UPPER(f.desc_produto) LIKE '%1KG%' THEN '1 KG'
      WHEN UPPER(f.desc_produto) LIKE '%5KG%' OR UPPER(f.desc_produto) LIKE '%5 KG%' THEN '5 KG'
      WHEN UPPER(f.desc_produto) LIKE '%CAPSULA%' OR UPPER(f.desc_produto) LIKE '%CÁPSULA%' THEN 'Cápsula'
      WHEN UPPER(f.desc_produto) LIKE '%DRIP%' THEN 'Drip'
      WHEN UPPER(f.desc_produto) LIKE '%GEISHA%' THEN 'Geisha'
      WHEN UPPER(f.desc_produto) LIKE '%VERDE%' THEN 'Café Verde'
      WHEN UPPER(f.desc_produto) LIKE '%GRAO%' OR UPPER(f.desc_produto) LIKE '%GRÃO%' THEN 'Grão'
      WHEN UPPER(f.desc_produto) LIKE '%MOIDO%' OR UPPER(f.desc_produto) LIKE '%MOÍDO%' THEN 'Moído'
      WHEN UPPER(f.desc_produto) LIKE '%ACESSORIO%' OR UPPER(f.desc_produto) LIKE '%GARRAFA%' OR UPPER(f.desc_produto) LIKE '%CANECA%' OR UPPER(f.desc_produto) LIKE '%KIT%' THEN 'Acessório'
      ELSE 'Outros'
    END as tipo_produto,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'SP'
        ELSE b.uf
      END,
      'SP'
    ) as uf,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.canal
      END,
      'Outros'
    ) as channel,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0))
      ELSE COALESCE(CAST(f.vlr_total_liq AS numeric), 0)
    END as net_value,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.quantidade AS numeric), 0))
      ELSE COALESCE(CAST(f.quantidade AS numeric), 0)
    END as quantity,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0))
      ELSE (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0))
    END as imposto,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.custo_total AS numeric), 0))
      ELSE COALESCE(CAST(f.custo_total AS numeric), 0)
    END as custo_total,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_frete AS numeric), 0))
      ELSE COALESCE(CAST(f.vlr_frete AS numeric), 0)
    END as custo_frete
  FROM cm_faturamento_sankhya f
  LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE f.dt_faturamento IS NOT NULL
    AND (
      (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND f.cod_top::numeric = 1100)
      OR
      (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND b.manager IS NOT NULL AND b.manager NOT IN ('Ecommerce', 'Marketplace'))
    )
)
SELECT
  mes,
  manager,
  rede,
  nome_parceiro,
  tipo_produto,
  uf,
  channel,
  SUM(net_value) as fat,
  SUM(quantity) as qty,
  SUM(net_value - imposto - custo_total - custo_frete) as maco,
  COUNT(*) as num_vendas
FROM sales_enriched
GROUP BY mes, manager, rede, nome_parceiro, tipo_produto, uf, channel;

-- Índices
CREATE UNIQUE INDEX idx_mv_cliente_mensal_pk ON mv_vendas_cliente_mensal (mes, manager, rede, nome_parceiro, tipo_produto, uf, channel);
CREATE INDEX idx_mv_cliente_mensal_mes ON mv_vendas_cliente_mensal (mes);
CREATE INDEX idx_mv_cliente_mensal_manager ON mv_vendas_cliente_mensal (manager);
CREATE INDEX idx_mv_cliente_mensal_rede ON mv_vendas_cliente_mensal (rede);


-- ============================================================
-- MV 3: mv_positivacao_sku_mensal
-- SKUs por cliente/mês — para positivação e batalha naval
-- ~50.000 linhas
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS mv_positivacao_sku_mensal CASCADE;

CREATE MATERIALIZED VIEW mv_positivacao_sku_mensal AS
WITH sales_enriched AS (
  SELECT 
    SUBSTRING(CAST(f.dt_faturamento AS text), 1, 7) as mes,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.manager
      END,
      'Outros'
    ) as manager,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.rede
      END,
      f.nome_parceiro,
      'Não Mapeado'
    ) as rede,
    f.nome_parceiro,
    f.desc_produto as product,
    CASE 
      WHEN UPPER(f.desc_produto) LIKE '%1KG%' THEN '1 KG'
      WHEN UPPER(f.desc_produto) LIKE '%5KG%' OR UPPER(f.desc_produto) LIKE '%5 KG%' THEN '5 KG'
      WHEN UPPER(f.desc_produto) LIKE '%CAPSULA%' OR UPPER(f.desc_produto) LIKE '%CÁPSULA%' THEN 'Cápsula'
      WHEN UPPER(f.desc_produto) LIKE '%DRIP%' THEN 'Drip'
      WHEN UPPER(f.desc_produto) LIKE '%GEISHA%' THEN 'Geisha'
      WHEN UPPER(f.desc_produto) LIKE '%VERDE%' THEN 'Café Verde'
      WHEN UPPER(f.desc_produto) LIKE '%GRAO%' OR UPPER(f.desc_produto) LIKE '%GRÃO%' THEN 'Grão'
      WHEN UPPER(f.desc_produto) LIKE '%MOIDO%' OR UPPER(f.desc_produto) LIKE '%MOÍDO%' THEN 'Moído'
      WHEN UPPER(f.desc_produto) LIKE '%ACESSORIO%' OR UPPER(f.desc_produto) LIKE '%GARRAFA%' OR UPPER(f.desc_produto) LIKE '%CANECA%' OR UPPER(f.desc_produto) LIKE '%KIT%' THEN 'Acessório'
      ELSE 'Outros'
    END as tipo_produto,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'SP'
        ELSE b.uf
      END,
      'SP'
    ) as uf,
    COALESCE(
      CASE 
        WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
        WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') THEN 'Marketplace'
        ELSE b.canal
      END,
      'Outros'
    ) as channel,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0))
      ELSE COALESCE(CAST(f.vlr_total_liq AS numeric), 0)
    END as net_value,
    CASE 
      WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.quantidade AS numeric), 0))
      ELSE COALESCE(CAST(f.quantidade AS numeric), 0)
    END as quantity
  FROM cm_faturamento_sankhya f
  LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE f.dt_faturamento IS NOT NULL
    AND (
      (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND f.cod_top::numeric = 1100)
      OR
      (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P') AND b.manager IS NOT NULL AND b.manager NOT IN ('Ecommerce', 'Marketplace'))
    )
)
SELECT
  mes,
  manager,
  rede,
  nome_parceiro,
  product,
  tipo_produto,
  uf,
  channel,
  SUM(quantity) as qty,
  SUM(net_value) as fat
FROM sales_enriched
GROUP BY mes, manager, rede, nome_parceiro, product, tipo_produto, uf, channel;

-- Índices
CREATE INDEX idx_mv_sku_mensal_mes ON mv_positivacao_sku_mensal (mes);
CREATE INDEX idx_mv_sku_mensal_manager ON mv_positivacao_sku_mensal (manager);
CREATE INDEX idx_mv_sku_mensal_product ON mv_positivacao_sku_mensal (product);


-- ============================================================
-- Função de Refresh
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_cliente_mensal;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_positivacao_sku_mensal;
END;
$$;

-- Dar permissão de execução
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO anon, authenticated, service_role;

-- Dar permissão de leitura nas MVs
GRANT SELECT ON mv_vendas_mensal TO anon, authenticated, service_role;
GRANT SELECT ON mv_vendas_cliente_mensal TO anon, authenticated, service_role;
GRANT SELECT ON mv_positivacao_sku_mensal TO anon, authenticated, service_role;
