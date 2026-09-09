-- Migration: 20260909_gate_4_4_harmonizacao_integrada_mvs.sql
-- Description: Gate 4.4 - Implementação controlada da harmonização integrada das Materialized Views do Coffee++.
--              Ajusta mv_vendas_agg, mv_vendas_cliente_mensal e mv_positivacao_sku_mensal para remover nome_parceiro
--              das cláusulas GROUP BY e projetá-lo via agregação determinística MAX(nome_parceiro).
--              Preserva integralmente as granularidades canônicas e os UNIQUE INDEXES de cada estrutura.
-- Author: Coffee++ Engineering Team (Gate 4.4)

-- 1. Dropar a cadeia materializada dependente em cascata
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_agg CASCADE;

-- 2. Recriar public.mv_vendas_agg com granularidade canônica e MAX(nome_parceiro)
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
    COALESCE(f.valor_venda_futura, (0)::numeric) AS valor_venda_futura
  FROM public.cm_faturamento_sankhya f
  WHERE (f.dt_faturamento IS NOT NULL)
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text)
    AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text)
    AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text)
    AND (
      (
        (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]))
        AND ((f.cod_top)::numeric = ANY (ARRAY[1100, 1200, 1201, 1723, 1117, 1703]::numeric[]))
      )
      OR
      (
        (f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text]))
        AND ((f.cod_top)::numeric = ANY (ARRAY[1100, 1200, 1201, 1713, 1117, 1703]::numeric[]))
      )
    )
)
SELECT 
  mes,
  ano,
  mes_num,
  cod_parceiro,
  MAX(nome_parceiro) AS nome_parceiro,
  product,
  tipo_produto,
  nome_vendedor,
  cod_top,
  sum(net_value) AS net_value,
  sum(quantity) AS quantity,
  sum(imposto) AS imposto,
  sum(custo_total) AS custo_total,
  sum(custo_frete) AS custo_frete,
  sum(valor_venda_futura) AS valor_venda_futura,
  count(*) AS num_vendas
FROM sales_base
GROUP BY mes, ano, mes_num, cod_parceiro, product, tipo_produto, nome_vendedor, cod_top;

-- 3. Recriar índice UNIQUE canônico de public.mv_vendas_agg
CREATE UNIQUE INDEX mv_vendas_agg_uidx 
ON public.mv_vendas_agg (mes, cod_parceiro, product, cod_top, nome_vendedor);

-- 4. Recriar public.mv_vendas_mensal (preservada na íntegra da homologação oficial)
CREATE MATERIALIZED VIEW public.mv_vendas_mensal AS
SELECT v.mes,
   v.ano,
   v.mes_num,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN ('1008'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN ('1005'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN ('1006'::text)::character varying
           WHEN (r.manager_id_apuracao IS NOT NULL) THEN (r.manager_id_apuracao)::character varying
           WHEN ((c.manager_id)::text = ANY ((ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying])::text[])) THEN c.manager_id
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN ('1007'::text)::character varying
           ELSE c.manager_id
       END, ('9999'::text)::character varying) AS manager_id,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           WHEN ((c.matriz IS NOT NULL) AND (TRIM(BOTH FROM c.matriz) <> ''::text)) THEN c.matriz
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN 'Distribuidor'::text
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
   sum(v.net_value) AS fat,
   sum(v.quantity) AS qty,
   sum((((v.net_value - v.imposto) - v.custo_total) - v.custo_frete)) AS maco,
   sum(v.imposto) AS total_imposto,
   sum(v.custo_total) AS total_custo,
   sum(v.custo_frete) AS total_frete,
   sum(v.valor_venda_futura) AS valor_venda_futura,
   sum(v.num_vendas) AS num_vendas,
   count(DISTINCT v.nome_parceiro) AS clientes_distintos,
   count(DISTINCT v.product) AS skus_distintos,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
           WHEN ((c.manager_id)::text = ANY ((ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying])::text[])) THEN c.responsavel
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN 'Distribuidor'::text
           ELSE c.responsavel
       END, 'SEM RESPONSÁVEL'::text) AS manager
  FROM ((public.mv_vendas_agg v
    LEFT JOIN public.cm_clientes c ON ((c.codigo = (v.cod_parceiro)::integer)))
    LEFT JOIN public.cm_regras_apuracao_comercial r ON (((r.matriz_nome = c.matriz) AND (r.ativa = true))))
 WHERE (NOT ((v.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND (COALESCE(c.responsavel, 'SEM RESPONSÁVEL'::text) = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))
 GROUP BY v.mes, v.ano, v.mes_num, COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN ('1008'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN ('1005'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN ('1006'::text)::character varying
           WHEN (r.manager_id_apuracao IS NOT NULL) THEN (r.manager_id_apuracao)::character varying
           WHEN ((c.manager_id)::text = ANY ((ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying])::text[])) THEN c.manager_id
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN ('1007'::text)::character varying
           ELSE c.manager_id
       END, ('9999'::text)::character varying), COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           WHEN ((c.matriz IS NOT NULL) AND (TRIM(BOTH FROM c.matriz) <> ''::text)) THEN c.matriz
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN 'Distribuidor'::text
           ELSE c.matriz
       END, v.nome_parceiro, 'Não Mapeado'::text), v.tipo_produto, COALESCE(
       CASE
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
           ELSE c.uf
       END, 'SP'::text), COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           ELSE c.tipo_parceiro
       END, 'Outros'::text), COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
           WHEN ((c.manager_id)::text = ANY ((ARRAY['1000'::character varying, '1001'::character varying, '1002'::character varying, '1003'::character varying])::text[])) THEN c.responsavel
           WHEN ((v.nome_vendedor = 'DISTRIBUIDOR'::text) OR (c.tipo_parceiro = 'Distribuidor'::text)) THEN 'Distribuidor'::text
           ELSE c.responsavel
       END, 'SEM RESPONSÁVEL'::text);

CREATE UNIQUE INDEX mv_vendas_mensal_uidx 
ON public.mv_vendas_mensal (mes, manager_id, rede, tipo_produto, uf, channel);

-- 5. Recriar public.mv_vendas_cliente_mensal com granularidade canônica (mes, cod_parceiro)
CREATE MATERIALIZED VIEW public.mv_vendas_cliente_mensal AS
SELECT v.mes,
   v.ano,
   v.mes_num,
   v.cod_parceiro,
   MAX(v.nome_parceiro) AS nome_parceiro,
   COALESCE(c.matriz, MAX(v.nome_parceiro)) AS rede,
   COALESCE(c.uf, 'SP'::text) AS uf,
   COALESCE(c.tipo_parceiro, 'Outros'::text) AS channel,
   COALESCE(r.manager_id_apuracao, (c.manager_id)::text, '9999'::text) AS manager_id,
   COALESCE(r.gerente_apuracao, c.responsavel, 'SEM RESPONSÁVEL'::text) AS manager,
   sum(v.net_value) AS fat,
   sum(v.quantity) AS qty,
   sum((((v.net_value - v.imposto) - v.custo_total) - v.custo_frete)) AS maco,
   sum(v.imposto) AS total_imposto,
   sum(v.custo_total) AS total_custo,
   sum(v.custo_frete) AS total_frete,
   sum(v.valor_venda_futura) AS valor_venda_futura,
   sum(v.num_vendas) AS num_vendas,
   count(DISTINCT v.product) AS skus_distintos
  FROM ((public.mv_vendas_agg v
    LEFT JOIN public.cm_clientes c ON ((c.codigo = (v.cod_parceiro)::integer)))
    LEFT JOIN public.cm_regras_apuracao_comercial r ON (((r.matriz_nome = c.matriz) AND (r.ativa = true))))
 GROUP BY v.mes, v.ano, v.mes_num, v.cod_parceiro, c.matriz, COALESCE(c.uf, 'SP'::text), COALESCE(c.tipo_parceiro, 'Outros'::text), COALESCE(r.manager_id_apuracao, (c.manager_id)::text, '9999'::text), COALESCE(r.gerente_apuracao, c.responsavel, 'SEM RESPONSÁVEL'::text);

CREATE UNIQUE INDEX mv_vendas_cliente_mensal_uidx 
ON public.mv_vendas_cliente_mensal (mes, cod_parceiro);

-- 6. Recriar public.mv_positivacao_sku_mensal sem nome_parceiro no GROUP BY
CREATE MATERIALIZED VIEW public.mv_positivacao_sku_mensal AS
SELECT v.mes,
   v.ano,
   v.mes_num,
   v.cod_parceiro,
   MAX(v.nome_parceiro) AS nome_parceiro,
   v.product,
   v.tipo_produto,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN ('1008'::text)::character varying
           WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN ('1007'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN ('1005'::text)::character varying
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN ('1006'::text)::character varying
           ELSE c.manager_id
       END, ('9999'::text)::character varying) AS manager_id,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           ELSE c.responsavel
       END, 'SEM RESPONSÁVEL'::text) AS manager,
   COALESCE(
       CASE
           WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
           WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
           WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
           ELSE c.matriz
       END, v.nome_parceiro, 'Não Mapeado'::text) AS rede,
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
   sum(v.net_value) AS fat,
   sum(v.quantity) AS qty,
   sum(v.num_vendas) AS num_vendas
  FROM (public.mv_vendas_agg v
    LEFT JOIN public.cm_clientes c ON ((c.codigo = (v.cod_parceiro)::integer)))
  WHERE (NOT ((v.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND (COALESCE(c.responsavel, 'SEM RESPONSÁVEL'::text) = ANY (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))
  GROUP BY v.mes, v.ano, v.mes_num, v.cod_parceiro, v.product, v.tipo_produto, COALESCE(
        CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN ('1008'::text)::character varying
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN ('1007'::text)::character varying
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN ('1005'::text)::character varying
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN ('1006'::text)::character varying
            ELSE c.manager_id
        END, ('9999'::text)::character varying), COALESCE(
        CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.responsavel
        END, 'SEM RESPONSÁVEL'::text), COALESCE(
        CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.matriz
        END, v.nome_parceiro, 'Não Mapeado'::text), COALESCE(
        CASE
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
            ELSE c.uf
        END, 'SP'::text), COALESCE(
        CASE
            WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
            WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
            ELSE c.tipo_parceiro
        END, 'Outros'::text);

CREATE UNIQUE INDEX idx_mv_positivacao_sku_unique 
ON public.mv_positivacao_sku_mensal (mes, cod_parceiro, product, manager_id, rede);

CREATE INDEX idx_mv_positivacao_sku_mes 
ON public.mv_positivacao_sku_mensal (mes);

CREATE INDEX idx_mv_positivacao_sku_manager 
ON public.mv_positivacao_sku_mensal (manager);

CREATE INDEX idx_mv_positivacao_sku_product 
ON public.mv_positivacao_sku_mensal (product);

-- 7. Permissões de leitura
GRANT SELECT ON public.mv_vendas_agg TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_mensal TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_vendas_cliente_mensal TO anon, authenticated, service_role;
GRANT SELECT ON public.mv_positivacao_sku_mensal TO anon, authenticated, service_role;

-- 8. Recriação de vw_mv_health_check
CREATE OR REPLACE VIEW public.vw_mv_health_check AS
WITH oficial_monthly AS (
  SELECT to_char(f.dt_faturamento::timestamp with time zone, 'YYYY-MM'::text) AS mes,
    sum(
      CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(f.vlr_total_liq)
        ELSE f.vlr_total_liq
      END) AS sum_val
  FROM cm_faturamento f
    LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE f.dt_faturamento >= (CURRENT_DATE - '7 mons'::interval) 
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text) 
    AND (f.nome_parceiro <> ALL (ARRAY['CAFE UTAM S/A'::text, 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text])) 
    AND ((f.cod_top = ANY (ARRAY['1100'::text, '1200'::text, '1201'::text, '1703'::text, '1713'::text, '1723'::text])) 
         OR (f.cod_top = '1117'::text AND (b.canal = 'KA'::text OR (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) OR f.nome_parceiro = 'BEATRIZ FERNANDA NEVES'::text)))
  GROUP BY (to_char(f.dt_faturamento::timestamp with time zone, 'YYYY-MM'::text))
), mv_monthly AS (
  SELECT mv_vendas_mensal.mes,
    sum(mv_vendas_mensal.fat) AS sum_val
  FROM mv_vendas_mensal
  WHERE mv_vendas_mensal.mes >= to_char(CURRENT_DATE - '7 mons'::interval, 'YYYY-MM'::text)
  GROUP BY mv_vendas_mensal.mes
)
SELECT COALESCE(o.mes, m.mes) AS mes,
  COALESCE(m.sum_val, 0::numeric) AS mv_fat,
  COALESCE(o.sum_val, 0::numeric) AS oficial_fat,
  abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) AS diff_abs,
  CASE
    WHEN COALESCE(o.sum_val, 0::numeric) = 0::numeric THEN 0::numeric
    ELSE round(abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) / COALESCE(o.sum_val, 0::numeric) * 100::numeric, 4)
  END AS diff_pct,
  (SELECT max(cm_mv_refresh_jobs.finished_at) AS max
   FROM cm_mv_refresh_jobs
   WHERE cm_mv_refresh_jobs.status::text = 'SUCCESS'::text) AS last_refresh_at,
  EXTRACT(epoch FROM clock_timestamp() - ((SELECT COALESCE(max(cm_mv_refresh_jobs.finished_at), clock_timestamp() - '1 day'::interval) AS "coalesce"
   FROM cm_mv_refresh_jobs
   WHERE cm_mv_refresh_jobs.status::text = 'SUCCESS'::text))) / 60::numeric AS age_minutes,
  CASE
    WHEN
    CASE
      WHEN COALESCE(o.sum_val, 0::numeric) = 0::numeric THEN 0::numeric
      ELSE abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) / COALESCE(o.sum_val, 0::numeric) * 100::numeric
    END > 0.5 THEN 'ALERT'::text
    ELSE 'OK'::text
  END AS status
FROM oficial_monthly o
  FULL JOIN mv_monthly m ON o.mes = m.mes
WHERE COALESCE(o.mes, m.mes) >= to_char(CURRENT_DATE - '6 mons'::interval, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_mv_health_check TO anon, authenticated, service_role;

-- 9. Bloco de Validação Transacional Obrigatória (Gate 4.4)
DO $$
DECLARE
  v_count INTEGER;
  v_val NUMERIC;
  v_qty NUMERIC;
BEGIN
  -- Teste 1: Validação do parceiro 202580 em mv_vendas_agg
  SELECT count(*), coalesce(sum(net_value), 0), coalesce(sum(quantity), 0)
  INTO v_count, v_val, v_qty
  FROM public.mv_vendas_agg
  WHERE mes = '2026-08' 
    AND cod_parceiro = '202580' 
    AND product = 'CAFE ARARA TIPO GRAO 250GR'
    AND cod_top = '1723'
    AND nome_vendedor = 'MELI FULL';
    
  IF v_count <> 1 OR v_val <> 149.70 OR v_qty <> 5 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_vendas_agg parceiro 202580 esperado 1 linha, R$ 149.70, 5 UN, obtido % linhas, % R$, % UN', v_count, v_val, v_qty;
  END IF;

  -- Teste 2: Validação do parceiro 202580 em mv_vendas_cliente_mensal
  SELECT count(*), coalesce(sum(fat), 0), coalesce(sum(qty), 0)
  INTO v_count, v_val, v_qty
  FROM public.mv_vendas_cliente_mensal
  WHERE mes = '2026-08' AND cod_parceiro = '202580';

  IF v_count <> 1 OR v_val <> 246.35 OR v_qty <> 9 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_vendas_cliente_mensal parceiro 202580 esperado 1 linha, R$ 246.35, 9 UN, obtido % linhas, % R$, % UN', v_count, v_val, v_qty;
  END IF;

  -- Teste 3: Validação do parceiro 202580 em mv_positivacao_sku_mensal
  SELECT count(*)
  INTO v_count
  FROM public.mv_positivacao_sku_mensal
  WHERE mes = '2026-08' 
    AND cod_parceiro = '202580'
    AND product = 'CAFE ARARA TIPO GRAO 250GR'
    AND manager_id = '1006'
    AND rede = 'Marketplace';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_positivacao_sku_mensal parceiro 202580 esperado 1 linha, obtido % linhas', v_count;
  END IF;

  -- Teste 4: Ausência de duplicidades lógicas em mv_vendas_agg
  SELECT count(*) INTO v_count
  FROM (
    SELECT mes, cod_parceiro, product, cod_top, nome_vendedor
    FROM public.mv_vendas_agg
    GROUP BY mes, cod_parceiro, product, cod_top, nome_vendedor
    HAVING count(*) > 1
  ) dup;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_vendas_agg possui % chaves lógicas duplicadas', v_count;
  END IF;

  -- Teste 5: Ausência de duplicidades lógicas em mv_vendas_cliente_mensal
  SELECT count(*) INTO v_count
  FROM (
    SELECT mes, cod_parceiro
    FROM public.mv_vendas_cliente_mensal
    GROUP BY mes, cod_parceiro
    HAVING count(*) > 1
  ) dup;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_vendas_cliente_mensal possui % chaves lógicas duplicadas', v_count;
  END IF;

  -- Teste 6: Ausência de duplicidades lógicas em mv_positivacao_sku_mensal
  SELECT count(*) INTO v_count
  FROM (
    SELECT mes, cod_parceiro, product, manager_id, rede
    FROM public.mv_positivacao_sku_mensal
    GROUP BY mes, cod_parceiro, product, manager_id, rede
    HAVING count(*) > 1
  ) dup;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'GATE 4.4 ASSERTION FAILED: mv_positivacao_sku_mensal possui % chaves lógicas duplicadas', v_count;
  END IF;

  RAISE NOTICE 'GATE 4.4: Todas as asserções transacionais foram APROVADAS com sucesso.';
END $$;

