-- Migration: 20260822_fix_mv_vendas_mensal_distributor_manager_attribution.sql
-- Description: Correção cirúrgica na Materialized View mv_vendas_mensal para atribuir corretamente o faturamento de distribuidores aos seus gerentes oficiais de carteira (1000-1003) antes do fallback corporativo (1007).

DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_mensal CASCADE;

CREATE MATERIALIZED VIEW public.mv_vendas_mensal AS
SELECT 
  v.mes,
  v.ano,
  v.mes_num,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN '1008'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      WHEN (r.manager_id_apuracao IS NOT NULL) THEN r.manager_id_apuracao
      WHEN (c.manager_id IN ('1000', '1001', '1002', '1003')) THEN c.manager_id
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN '1007'::text
      ELSE c.manager_id
    END, '9999'::text) AS manager_id,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      WHEN (c.matriz IS NOT NULL AND TRIM(c.matriz) <> '') THEN c.matriz
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN 'Distribuidor'::text
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
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
      WHEN (c.manager_id IN ('1000', '1001', '1002', '1003')) THEN c.responsavel
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN 'Distribuidor'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text) AS manager
FROM public.mv_vendas_agg v
LEFT JOIN public.cm_clientes c ON c.codigo = v.cod_parceiro::integer
LEFT JOIN public.cm_regras_apuracao_comercial r ON r.matriz_nome = c.matriz AND r.ativa = true
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
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      WHEN (r.manager_id_apuracao IS NOT NULL) THEN r.manager_id_apuracao
      WHEN (c.manager_id IN ('1000', '1001', '1002', '1003')) THEN c.manager_id
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN '1007'::text
      ELSE c.manager_id
    END, '9999'::text),
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      WHEN (c.matriz IS NOT NULL AND TRIM(c.matriz) <> '') THEN c.matriz
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN 'Distribuidor'::text
      ELSE c.matriz
    END, v.nome_parceiro, 'Não Mapeado'::text),
  v.tipo_produto,
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
      ELSE c.uf
    END, 'SP'::text),
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      ELSE c.tipo_parceiro
    END, 'Outros'::text),
  COALESCE(
    CASE
      WHEN (v.nome_vendedor = 'AMAZON 1P'::text) THEN 'Amazon 1P'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
      WHEN (c.manager_id IN ('1000', '1001', '1002', '1003')) THEN c.responsavel
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text OR c.tipo_parceiro = 'Distribuidor') THEN 'Distribuidor'::text
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text);

-- Unique index para permitir REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_mensal_uidx ON public.mv_vendas_mensal (mes, manager_id, rede, tipo_produto, uf, channel);

-- Permissões
GRANT SELECT ON public.mv_vendas_mensal TO authenticated, anon, service_role;

-- Recriar view dependente vw_mv_health_check
CREATE OR REPLACE VIEW public.vw_mv_health_check AS
WITH oficial_monthly AS (
  SELECT 
    to_char(f.dt_faturamento::timestamp with time zone, 'YYYY-MM'::text) AS mes,
    SUM(
      CASE
        WHEN f.cod_top = ANY (ARRAY['1200'::text, '1201'::text]) THEN - abs(f.vlr_total_liq)
        ELSE f.vlr_total_liq
      END
    ) AS sum_val
  FROM cm_faturamento f
  LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE f.dt_faturamento >= (CURRENT_DATE - '7 mons'::interval) 
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text) 
    AND (f.nome_parceiro <> ALL (ARRAY['CAFE UTAM S/A'::text, 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text])) 
    AND (
      (f.cod_top = ANY (ARRAY['1100'::text, '1200'::text, '1201'::text, '1703'::text, '1713'::text, '1723'::text])) 
      OR (f.cod_top = '1117'::text AND (b.canal = 'KA'::text OR (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) OR f.nome_parceiro = 'BEATRIZ FERNANDA NEVES'::text))
    )
  GROUP BY to_char(f.dt_faturamento::timestamp with time zone, 'YYYY-MM'::text)
), 
mv_monthly AS (
  SELECT 
    mv_vendas_mensal.mes,
    SUM(mv_vendas_mensal.fat) AS sum_val
  FROM mv_vendas_mensal
  WHERE mv_vendas_mensal.mes >= to_char(CURRENT_DATE - '7 mons'::interval, 'YYYY-MM'::text)
  GROUP BY mv_vendas_mensal.mes
)
SELECT 
  COALESCE(o.mes, m.mes) AS mes,
  COALESCE(m.sum_val, 0::numeric) AS mv_fat,
  COALESCE(o.sum_val, 0::numeric) AS oficial_fat,
  abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) AS diff_abs,
  CASE
    WHEN COALESCE(o.sum_val, 0::numeric) = 0::numeric THEN 0::numeric
    ELSE round(abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) / COALESCE(o.sum_val, 0::numeric) * 100::numeric, 4)
  END AS diff_pct,
  (SELECT max(cm_mv_refresh_jobs.finished_at) AS max FROM cm_mv_refresh_jobs WHERE cm_mv_refresh_jobs.status::text = 'SUCCESS'::text) AS last_refresh_at,
  EXTRACT(epoch FROM clock_timestamp() - ((SELECT COALESCE(max(cm_mv_refresh_jobs.finished_at), clock_timestamp() - '1 day'::interval) FROM cm_mv_refresh_jobs WHERE cm_mv_refresh_jobs.status::text = 'SUCCESS'::text))) / 60::numeric AS age_minutes,
  CASE
    WHEN CASE
      WHEN COALESCE(o.sum_val, 0::numeric) = 0::numeric THEN 0::numeric
      ELSE abs(COALESCE(o.sum_val, 0::numeric) - COALESCE(m.sum_val, 0::numeric)) / COALESCE(o.sum_val, 0::numeric) * 100::numeric
    END > 0.5 THEN 'ALERT'::text
    ELSE 'OK'::text
  END AS status
FROM oficial_monthly o
FULL JOIN mv_monthly m ON o.mes = m.mes
WHERE COALESCE(o.mes, m.mes) >= to_char(CURRENT_DATE - '6 mons'::interval, 'YYYY-MM'::text);

GRANT SELECT ON public.vw_mv_health_check TO authenticated, anon, service_role;
