-- ==============================================================================
-- MIGRATION: 20260822_align_public_sales_channel_classification.sql
-- DEMANDA 073: Alinhamento da Classificação Dimensional de Canais em public.sales
-- ==============================================================================
-- OBJETIVO:
-- Corrigir a classificação de canais e gerentes na view public.sales, alinhando-a
-- estritamente à hierarquia homologada na view materializada public.mv_vendas_mensal.
--
-- REGRAS:
-- 1. Identificação de canais digitais pelo vendedor/origem Sankhya:
--    - Shopify, Livelo -> Ecommerce (1005)
--    - AmazonFBA, Meli Full, Shopee, AmazonBR, AnyMarket, Magalu, Meli -> Marketplace (1006)
--    - Amazon 1P -> Amazon 1P (1008)
-- 2. Carteira oficial de gerentes KA respeita prioridade 1000-1003 de cm_clientes.
-- 3. Distribuidores respeitam regras homologadas (vendedor Sankhya / cm_clientes).
-- 4. Paridade financeira absoluta: Total Antes = Total Depois (Delta R$ 0,00).
-- ==============================================================================

CREATE OR REPLACE VIEW public.sales AS
SELECT 
    s.id::text AS id,
    s.chave,
    s.invoice_date,
    s.ano,
    s.mes,
    s.dia,
    s.ano_mes,
    s.invoice_number,
    s.unique_number,
    s.cod_parceiro,
    s.cod_produto,
    s.product,
    s.tipo_produto,
    s.quantity::numeric AS quantity,
    s.net_value::numeric AS net_value,
    s.vlr_unitario::numeric AS vlr_unitario,
    s.imposto::numeric AS imposto,
    s.custo_unitario::numeric AS custo_unitario,
    s.custo_total::numeric AS custo_total,
    s.discount::numeric AS discount,
    s.receita_frete::numeric AS receita_frete,
    s.custo_frete::numeric AS custo_frete,
    s.vlr_frete::numeric AS vlr_frete,
    s.vlr_substituicao::numeric AS vlr_substituicao,
    s.cfop,
    s.seller,
    s.empresa,
    s.payment_type,
    b.nome_parceiro,
    b.rede,
    b.rede_uf AS network_uf,
    b.canal AS channel,
    b.manager,
    b.uf,
    b.regional,
    b.ka,
    s.net_value::numeric - s.imposto::numeric - s.custo_total::numeric AS maco,
    b.manager_id::character varying AS manager_id
FROM sales_v2 s
LEFT JOIN base_atendimento b ON s.cod_parceiro = b.cod_parceiro
WHERE s.invoice_date < '2025-01-01'::date

UNION ALL

SELECT 
    f.id::text AS id,
    (((f.nro_nota || '|'::text) || f.cod_produto) || '|'::text) || f.cod_parceiro AS chave,
    f.dt_faturamento AS invoice_date,
    EXTRACT(year FROM f.dt_faturamento)::integer AS ano,
    EXTRACT(month FROM f.dt_faturamento)::integer AS mes,
    EXTRACT(day FROM f.dt_faturamento)::integer AS dia,
    to_char(f.dt_faturamento::timestamp with time zone, 'YYYY_MM'::text) AS ano_mes,
    f.nro_nota AS invoice_number,
    f.nro_unico AS unique_number,
    f.cod_parceiro,
    f.cod_produto,
    f.desc_produto AS product,
    CASE
        WHEN upper(f.desc_produto) ~~ '%1KG%'::text THEN '1 KG'::text
        WHEN upper(f.desc_produto) ~~ '%5KG%'::text OR upper(f.desc_produto) ~~ '%5 KG%'::text THEN '5 KG'::text
        WHEN upper(f.desc_produto) ~~ '%CAPSULA%'::text OR upper(f.desc_produto) ~~ '%CÁPSULA%'::text THEN 'Cápsula'::text
        WHEN upper(f.desc_produto) ~~ '%DRIP%'::text THEN 'Drip'::text
        WHEN upper(f.desc_produto) ~~ '%GEISHA%'::text THEN 'Geisha'::text
        WHEN upper(f.desc_produto) ~~ '%VERDE%'::text THEN 'Café Verde'::text
        WHEN upper(f.desc_produto) ~~ '%GRAO%'::text OR upper(f.desc_produto) ~~ '%GRÃO%'::text THEN 'Grão'::text
        WHEN upper(f.desc_produto) ~~ '%MOIDO%'::text OR upper(f.desc_produto) ~~ '%MOÍDO%'::text THEN 'Moído'::text
        WHEN upper(f.desc_produto) ~~ '%ACESSORIO%'::text OR upper(f.desc_produto) ~~ '%GARRAFA%'::text OR upper(f.desc_produto) ~~ '%CANECA%'::text OR upper(f.desc_produto) ~~ '%KIT%'::text THEN 'Acessório'::text
        ELSE 'Outros'::text
    END AS tipo_produto,
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.quantidade, 0::numeric))
        ELSE COALESCE(f.quantidade, 0::numeric)
    END AS quantity,
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.vlr_total_liq, 0::numeric))
        ELSE COALESCE(f.vlr_total_liq, 0::numeric)
    END AS net_value,
    f.vlr_unitario,
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.custo_icms, 0::numeric) +
        CASE
            WHEN COALESCE(f.vlr_total_st, 0::numeric) >= abs(COALESCE(f.vlr_total_liq, 0::numeric)) THEN 0::numeric
            ELSE COALESCE(f.vlr_total_st, 0::numeric)
        END)
        ELSE COALESCE(f.custo_icms, 0::numeric) +
        CASE
            WHEN COALESCE(f.vlr_total_st, 0::numeric) >= abs(COALESCE(f.vlr_total_liq, 0::numeric)) THEN 0::numeric
            ELSE COALESCE(f.vlr_total_st, 0::numeric)
        END
    END AS imposto,
    f.custo_total / NULLIF(f.quantidade, 0::numeric) AS custo_unitario,
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.custo_total, 0::numeric))
        ELSE COALESCE(f.custo_total, 0::numeric)
    END AS custo_total,
    f.vlr_desconto AS discount,
    f.vlr_frete AS receita_frete,
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.vlr_frete, 0::numeric))
        ELSE COALESCE(f.vlr_frete, 0::numeric)
    END AS custo_frete,
    f.vlr_frete,
    f.vlr_substituicao,
    f.cod_cfop AS cfop,
    f.nome_vendedor AS seller,
    f.nome_vendedor AS empresa,
    f.desc_top AS payment_type,
    f.nome_parceiro,
    COALESCE(
        CASE
            WHEN f.nome_vendedor = 'AMAZON 1P'::text THEN 'Amazon 1P'::text
            WHEN f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text]) THEN 'Ecommerce'::text
            WHEN f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) THEN 'Marketplace'::text
            WHEN c.matriz IS NOT NULL AND TRIM(c.matriz) <> ''::text THEN c.matriz
            WHEN f.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor'::text THEN 'Distribuidor'::text
            ELSE c.matriz
        END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
    COALESCE(c.uf, 'SP'::text) AS network_uf,
    COALESCE(
        CASE
            WHEN f.nome_vendedor = 'AMAZON 1P'::text THEN 'Amazon 1P'::text
            WHEN f.nome_vendedor = 'DISTRIBUIDOR'::text THEN 'Distribuidor'::text
            WHEN f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text]) THEN 'Ecommerce'::text
            WHEN f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) THEN 'Marketplace'::text
            ELSE c.tipo_parceiro
        END, 'Outros'::text) AS channel,
    COALESCE(
        CASE
            WHEN f.nome_vendedor = 'AMAZON 1P'::text THEN 'Amazon 1P'::text
            WHEN f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text]) THEN 'Ecommerce'::text
            WHEN f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) THEN 'Marketplace'::text
            WHEN r.gerente_apuracao IS NOT NULL THEN r.gerente_apuracao
            WHEN c.manager_id::text = ANY (ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying]::text[]) THEN c.responsavel
            WHEN f.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor'::text THEN 'Distribuidor'::text
            ELSE c.responsavel
        END, 'SEM RESPONSÁVEL'::text) AS manager,
    COALESCE(
        CASE
            WHEN f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text]) THEN 'SP'::text
            ELSE c.uf
        END, 'SP'::text) AS uf,
    COALESCE(c.regional, 'Sudeste'::text) AS regional,
    CASE WHEN c.tipo_parceiro = 'KA' THEN c.responsavel ELSE NULL END AS ka,
    (CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.vlr_total_liq, 0::numeric))
        ELSE COALESCE(f.vlr_total_liq, 0::numeric)
    END -
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.custo_icms, 0::numeric) +
        CASE
            WHEN COALESCE(f.vlr_total_st, 0::numeric) >= abs(COALESCE(f.vlr_total_liq, 0::numeric)) THEN 0::numeric
            ELSE COALESCE(f.vlr_total_st, 0::numeric)
        END)
        ELSE COALESCE(f.custo_icms, 0::numeric) +
        CASE
            WHEN COALESCE(f.vlr_total_st, 0::numeric) >= abs(COALESCE(f.vlr_total_liq, 0::numeric)) THEN 0::numeric
            ELSE COALESCE(f.vlr_total_st, 0::numeric)
        END
    END -
    CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(COALESCE(f.custo_total, 0::numeric))
        ELSE COALESCE(f.custo_total, 0::numeric)
    END) AS maco,
    COALESCE(
        CASE
            WHEN f.nome_vendedor = 'AMAZON 1P'::text THEN '1008'::text::character varying
            WHEN f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text]) THEN '1005'::text::character varying
            WHEN f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]) THEN '1006'::text::character varying
            WHEN r.manager_id_apuracao IS NOT NULL THEN r.manager_id_apuracao::character varying
            WHEN c.manager_id::text = ANY (ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying]::text[]) THEN c.manager_id
            WHEN f.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor'::text THEN '1007'::text::character varying
            ELSE c.manager_id
        END, '9999'::text::character varying) AS manager_id
FROM cm_faturamento f
LEFT JOIN cm_clientes c ON c.codigo = f.cod_parceiro::integer
LEFT JOIN cm_regras_apuracao_comercial r ON r.matriz_nome = c.matriz AND r.ativa = true
WHERE f.dt_faturamento IS NOT NULL 
  AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text) 
  AND f.nome_parceiro <> 'CAFE UTAM S/A'::text 
  AND f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text 
  AND (
    (
      (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) 
      AND (f.cod_top::numeric = ANY (ARRAY[1100::numeric, 1200::numeric, 1201::numeric, 1723::numeric, 1117::numeric, 1703::numeric]))
    ) 
    OR 
    (
      (f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) 
      AND (f.cod_top::numeric = ANY (ARRAY[1100::numeric, 1200::numeric, 1201::numeric, 1713::numeric, 1117::numeric, 1703::numeric])) 
      AND NOT (COALESCE(c.responsavel, 'SEM RESPONSÁVEL'::text) = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text]))
    )
  );
