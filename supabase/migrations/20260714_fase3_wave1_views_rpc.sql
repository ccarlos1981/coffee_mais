-- Migration: 20260714_fase3_wave1_views_rpc.sql
-- Description: Phase 3 Wave 1 - Saneamento físico, Views e RPC get_actual_sales_v2

-- 1. Saneamento físico de dados para nomes canônicos
UPDATE public.targets 
SET manager = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE manager
END
WHERE manager_id IS NOT NULL;

UPDATE public.cm_weekly_projections 
SET manager = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE manager
END
WHERE manager_id IS NOT NULL;

UPDATE public.network_matrix 
SET manager = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE manager
END
WHERE manager_id IS NOT NULL;

UPDATE public.base_atendimento 
SET manager = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE manager
END
WHERE manager_id IS NOT NULL;

UPDATE public.cm_clientes 
SET responsavel = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE responsavel
END
WHERE manager_id IS NOT NULL;

UPDATE public.sales_legacy 
SET manager = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE manager
END
WHERE manager_id IS NOT NULL;

UPDATE public.cm_trade_calendario_anual 
SET gerente = CASE manager_id
  WHEN '1000' THEN 'Julliano'
  WHEN '1001' THEN 'Leandro Saffi'
  WHEN '1002' THEN 'Luiz'
  WHEN '1004' THEN 'Inside Sales'
  WHEN '1005' THEN 'Ecommerce'
  WHEN '1006' THEN 'Marketplace'
  WHEN '1007' THEN 'Distribuidor'
  WHEN '1008' THEN 'Amazon 1P'
  WHEN '1009' THEN 'Private Label'
  WHEN '1010' THEN 'Luisa'
  ELSE gerente
END
WHERE manager_id IS NOT NULL;

-- 2. Recriar View vw_matrix_ranking (Dropando primeiro)
DROP VIEW IF EXISTS public.vw_matrix_ranking;
CREATE VIEW public.vw_matrix_ranking AS
 SELECT nm.network AS matrix_name,
    count(DISTINCT s.network_uf) AS pdv_count,
    (sum(s.net_value) / (1000)::double precision) AS revenue_k,
    (sum(s.weight_kg) / (1000)::double precision) AS tons,
        CASE
            WHEN (sum(s.weight_kg) > (0)::double precision) THEN (sum(s.net_value) / sum(s.weight_kg))
            ELSE (0)::double precision
        END AS price_per_kg,
    rank() OVER (ORDER BY (sum(s.net_value)) DESC) AS rank,
    nm.manager_id,
    max(nm.manager)::character varying as manager
   FROM (public.sales_legacy s
     JOIN public.network_matrix nm ON (((s.network_uf)::text = (nm.network_uf)::text)))
  GROUP BY nm.network, nm.manager_id;

-- 3. Recriar Materialized Views com manager_id e sem duplicidade por string (usando MAX(manager))
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_mensal CASCADE;
CREATE MATERIALIZED VIEW public.mv_vendas_mensal AS
 WITH sales_enriched AS (
         SELECT "substring"((f.dt_faturamento)::text, 1, 7) AS mes,
            "substring"((f.dt_faturamento)::text, 1, 4) AS ano,
            (EXTRACT(month FROM f.dt_faturamento))::integer AS mes_num,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
                    ELSE b.manager_id
                END, '9999'::text) AS manager_id,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.manager
                END, 'Outros'::text) AS manager,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.rede
                END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
                CASE
                    WHEN (position('1KG' in upper(f.desc_produto)) > 0) THEN '1 KG'::text
                    WHEN (position('5KG' in upper(f.desc_produto)) > 0 OR position('5 KG' in upper(f.desc_produto)) > 0) THEN '5 KG'::text
                    WHEN (position('CAPSULA' in upper(f.desc_produto)) > 0 OR position('CÁPSULA' in upper(f.desc_produto)) > 0) THEN 'Cápsula'::text
                    WHEN (position('DRIP' in upper(f.desc_produto)) > 0) THEN 'Drip'::text
                    WHEN (position('GEISHA' in upper(f.desc_produto)) > 0) THEN 'Geisha'::text
                    WHEN (position('VERDE' in upper(f.desc_produto)) > 0) THEN 'Café Verde'::text
                    WHEN (position('GRAO' in upper(f.desc_produto)) > 0 OR position('GRÃO' in upper(f.desc_produto)) > 0) THEN 'Grão'::text
                    WHEN (position('MOIDO' in upper(f.desc_produto)) > 0 OR position('MOÍDO' in upper(f.desc_produto)) > 0) THEN 'Moído'::text
                    WHEN (position('ACESSORIO' in upper(f.desc_produto)) > 0 OR position('GARRAFA' in upper(f.desc_produto)) > 0 OR position('CANECA' in upper(f.desc_produto)) > 0 OR position('KIT' in upper(f.desc_produto)) > 0) THEN 'Acessório'::text
                    ELSE 'Outros'::text
                END AS tipo_produto,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
                    ELSE b.uf
                END, 'SP'::text) AS uf,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.canal
                END, 'Outros'::text) AS channel,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
                    ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
                END AS net_value,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, (0)::numeric)))
                    ELSE COALESCE(f.quantidade, (0)::numeric)
                END AS quantity,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) +
                    CASE
                        WHEN (COALESCE(f.vlr_total_st, (0)::numeric) >= abs(COALESCE(f.vlr_total_liq, (0)::numeric))) THEN (0)::numeric
                        ELSE COALESCE(f.vlr_total_st, (0)::numeric)
                    END)))
                    ELSE (COALESCE(f.custo_icms, (0)::numeric) +
                    CASE
                        WHEN (COALESCE(f.vlr_total_st, (0)::numeric) >= abs(COALESCE(f.vlr_total_liq, (0)::numeric))) THEN (0)::numeric
                        ELSE COALESCE(f.vlr_total_st, (0)::numeric)
                    END)
                END AS imposto,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
                    ELSE COALESCE(f.custo_total, (0)::numeric)
                END AS custo_total,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_frete, (0)::numeric)))
                    ELSE COALESCE(f.vlr_frete, (0)::numeric)
                END AS custo_frete,
            f.nome_parceiro,
            f.desc_produto AS product,
            f.cod_top
           FROM (cm_faturamento_sankhya f
             LEFT JOIN base_atendimento b ON ((b.cod_parceiro = f.cod_parceiro)))
          WHERE ((f.dt_faturamento IS NOT NULL) AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text)) AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text) AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text) AND (((f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1723)::numeric, (1117)::numeric, (1703)::numeric]))) OR ((f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1713)::numeric, (1117)::numeric, (1703)::numeric])) AND ((b.manager IS NULL) OR (b.manager <> ALL (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))))
        )
 SELECT mes,
    ano,
    mes_num,
    manager_id,
    rede,
    tipo_produto,
    uf,
    channel,
    sum(net_value) AS fat,
    sum(quantity) AS qty,
    sum((((net_value - imposto) - custo_total) - custo_frete)) AS maco,
    sum(imposto) AS total_imposto,
    sum(custo_total) AS total_custo,
    sum(custo_frete) AS total_frete,
    count(*) AS num_vendas,
    count(DISTINCT nome_parceiro) AS clientes_distintos,
    count(DISTINCT product) AS skus_distintos,
    max(manager)::character varying as manager
   FROM sales_enriched
  GROUP BY mes, ano, mes_num, manager_id, rede, tipo_produto, uf, channel;

DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_cliente_mensal CASCADE;
CREATE MATERIALIZED VIEW public.mv_vendas_cliente_mensal AS
 WITH sales_enriched AS (
         SELECT "substring"((f.dt_faturamento)::text, 1, 7) AS mes,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
                    ELSE b.manager_id
                END, '9999'::text) AS manager_id,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.manager
                END, 'Outros'::text) AS manager,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.rede
                END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
            f.nome_parceiro,
                CASE
                    WHEN (position('1KG' in upper(f.desc_produto)) > 0) THEN '1 KG'::text
                    WHEN (position('5KG' in upper(f.desc_produto)) > 0 OR position('5 KG' in upper(f.desc_produto)) > 0) THEN '5 KG'::text
                    WHEN (position('CAPSULA' in upper(f.desc_produto)) > 0 OR position('CÁPSULA' in upper(f.desc_produto)) > 0) THEN 'Cápsula'::text
                    WHEN (position('DRIP' in upper(f.desc_produto)) > 0) THEN 'Drip'::text
                    WHEN (position('GEISHA' in upper(f.desc_produto)) > 0) THEN 'Geisha'::text
                    WHEN (position('VERDE' in upper(f.desc_produto)) > 0) THEN 'Café Verde'::text
                    WHEN (position('GRAO' in upper(f.desc_produto)) > 0 OR position('GRÃO' in upper(f.desc_produto)) > 0) THEN 'Grão'::text
                    WHEN (position('MOIDO' in upper(f.desc_produto)) > 0 OR position('MOÍDO' in upper(f.desc_produto)) > 0) THEN 'Moído'::text
                    WHEN (position('ACESSORIO' in upper(f.desc_produto)) > 0 OR position('GARRAFA' in upper(f.desc_produto)) > 0 OR position('CANECA' in upper(f.desc_produto)) > 0 OR position('KIT' in upper(f.desc_produto)) > 0) THEN 'Acessório'::text
                    ELSE 'Outros'::text
                END AS tipo_produto,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
                    ELSE b.uf
                END, 'SP'::text) AS uf,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.canal
                END, 'Outros'::text) AS channel,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
                    ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
                END AS net_value,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, (0)::numeric)))
                    ELSE COALESCE(f.quantidade, (0)::numeric)
                END AS quantity,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) +
                    CASE
                        WHEN (COALESCE(f.vlr_total_st, (0)::numeric) >= abs(COALESCE(f.vlr_total_liq, (0)::numeric))) THEN (0)::numeric
                        ELSE COALESCE(f.vlr_total_st, (0)::numeric)
                    END)))
                    ELSE (COALESCE(f.custo_icms, (0)::numeric) +
                    CASE
                        WHEN (COALESCE(f.vlr_total_st, (0)::numeric) >= abs(COALESCE(f.vlr_total_liq, (0)::numeric))) THEN (0)::numeric
                        ELSE COALESCE(f.vlr_total_st, (0)::numeric)
                    END)
                END AS imposto,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
                    ELSE COALESCE(f.custo_total, (0)::numeric)
                END AS custo_total,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_frete, (0)::numeric)))
                    ELSE COALESCE(f.vlr_frete, (0)::numeric)
                END AS custo_frete
           FROM (cm_faturamento_sankhya f
             LEFT JOIN base_atendimento b ON ((b.cod_parceiro = f.cod_parceiro)))
          WHERE ((f.dt_faturamento IS NOT NULL) AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text)) AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text) AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text) AND (((f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1723)::numeric, (1117)::numeric, (1703)::numeric]))) OR ((f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1713)::numeric, (1117)::numeric, (1703)::numeric])) AND ((b.manager IS NULL) OR (b.manager <> ALL (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))))
        )
 SELECT mes,
    manager_id,
    rede,
    nome_parceiro,
    tipo_produto,
    uf,
    channel,
    sum(net_value) AS fat,
    sum(quantity) AS qty,
    sum((((net_value - imposto) - custo_total) - custo_frete)) AS maco,
    count(*) AS num_vendas,
    max(manager)::character varying as manager
   FROM sales_enriched
  GROUP BY mes, manager_id, rede, nome_parceiro, tipo_produto, uf, channel;

DROP MATERIALIZED VIEW IF EXISTS public.mv_positivacao_sku_mensal CASCADE;
CREATE MATERIALIZED VIEW public.mv_positivacao_sku_mensal AS
 WITH sales_enriched AS (
         SELECT "substring"((f.dt_faturamento)::text, 1, 7) AS mes,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
                    ELSE b.manager_id
                END, '9999'::text) AS manager_id,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.manager
                END, 'Outros'::text) AS manager,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.rede
                END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
            f.nome_parceiro,
            f.desc_produto AS product,
                CASE
                    WHEN (position('1KG' in upper(f.desc_produto)) > 0) THEN '1 KG'::text
                    WHEN (position('5KG' in upper(f.desc_produto)) > 0 OR position('5 KG' in upper(f.desc_produto)) > 0) THEN '5 KG'::text
                    WHEN (position('CAPSULA' in upper(f.desc_produto)) > 0 OR position('CÁPSULA' in upper(f.desc_produto)) > 0) THEN 'Cápsula'::text
                    WHEN (position('DRIP' in upper(f.desc_produto)) > 0) THEN 'Drip'::text
                    WHEN (position('GEISHA' in upper(f.desc_produto)) > 0) THEN 'Geisha'::text
                    WHEN (position('VERDE' in upper(f.desc_produto)) > 0) THEN 'Café Verde'::text
                    WHEN (position('GRAO' in upper(f.desc_produto)) > 0 OR position('GRÃO' in upper(f.desc_produto)) > 0) THEN 'Grão'::text
                    WHEN (position('MOIDO' in upper(f.desc_produto)) > 0 OR position('MOÍDO' in upper(f.desc_produto)) > 0) THEN 'Moído'::text
                    WHEN (position('ACESSORIO' in upper(f.desc_produto)) > 0 OR position('GARRAFA' in upper(f.desc_produto)) > 0 OR position('CANECA' in upper(f.desc_produto)) > 0 OR position('KIT' in upper(f.desc_produto)) > 0) THEN 'Acessório'::text
                    ELSE 'Outros'::text
                END AS tipo_produto,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
                    ELSE b.uf
                END, 'SP'::text) AS uf,
            COALESCE(
                CASE
                    WHEN (f.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
                    WHEN (f.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
                    WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
                    ELSE b.canal
                END, 'Outros'::text) AS channel,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, (0)::numeric)))
                    ELSE COALESCE(f.quantidade, (0)::numeric)
                END AS quantity,
                CASE
                    WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
                    ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
                END AS net_value
           FROM (cm_faturamento_sankhya f
             LEFT JOIN base_atendimento b ON ((b.cod_parceiro = f.cod_parceiro)))
          WHERE ((f.dt_faturamento IS NOT NULL) AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text)) AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text) AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text) AND (((f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1723)::numeric, (1117)::numeric, (1703)::numeric]))) OR ((f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1713)::numeric, (1117)::numeric, (1703)::numeric])) AND ((b.manager IS NULL) OR (b.manager <> ALL (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))))
        )
 SELECT mes,
    manager_id,
    rede,
    nome_parceiro,
    product,
    tipo_produto,
    uf,
    channel,
    sum(quantity) AS qty,
    sum(net_value) AS fat,
    max(manager)::character varying as manager
   FROM sales_enriched
  GROUP BY mes, manager_id, rede, nome_parceiro, product, tipo_produto, uf, channel;

-- 4. Criar indexes únicos lógicos nas Materialized Views para agilizar updates e queries
CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_mensal_uidx ON public.mv_vendas_mensal (mes, manager_id, rede, tipo_produto, uf, channel);
CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_cliente_mensal_uidx ON public.mv_vendas_cliente_mensal (mes, manager_id, rede, nome_parceiro, tipo_produto, uf, channel);
CREATE UNIQUE INDEX IF NOT EXISTS mv_positivacao_sku_mensal_uidx ON public.mv_positivacao_sku_mensal (mes, manager_id, rede, nome_parceiro, product, tipo_produto, uf, channel);

-- 5. Atualizar função get_actual_sales_v2 para suportar parâmetros distintos p_manager_id e p_manager_name de forma estritamente semântica
CREATE OR REPLACE FUNCTION public.get_actual_sales_v2(p_channel text, p_manager_id text, p_manager_name text, p_years text[])
 RETURNS TABLE(ano text, mes_num integer, fat numeric, qty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.ano,
    m.mes_num,
    COALESCE(SUM(m.fat), 0)::numeric as fat,
    COALESCE(SUM(m.qty), 0)::numeric as qty
  FROM mv_vendas_mensal m
  WHERE m.ano = ANY(p_years)
    AND (
      p_channel = 'Toda Empresa'
      OR (
        p_channel = 'KA' 
        AND m.channel = 'KA' 
        AND (
          -- Se p_manager_id existir e for diferente de nulo/vazio, usar manager_id
          (p_manager_id IS NOT NULL AND p_manager_id <> '' AND (p_manager_id = 'Total' OR m.manager_id = p_manager_id))
          OR
          -- Senão, fallback para manager_name
          ((p_manager_id IS NULL OR p_manager_id = '') AND (p_manager_name = 'Total' OR m.manager = p_manager_name))
        )
      )
      OR (p_channel <> 'KA' AND m.channel = p_channel)
    )
  GROUP BY m.ano, m.mes_num;
END;
$$;

-- 6. Recriar a versão de retrocompatibilidade de get_actual_sales_v2 de 3 parâmetros chamando a nova versão internamente
CREATE OR REPLACE FUNCTION public.get_actual_sales_v2(p_channel text, p_manager text, p_years text[])
 RETURNS TABLE(ano text, mes_num integer, fat numeric, qty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM public.get_actual_sales_v2(
    p_channel,
    p_manager, -- p_manager_id
    p_manager, -- p_manager_name
    p_years
  );
END;
$$;
