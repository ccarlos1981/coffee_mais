-- =============================================================================
-- Migration: 20260804_regras_apuracao_comercial.sql
-- Descrição: Fase 1 — Tabela de Regras Especiais de Apuração Comercial (REDE OBA -> Julliano)
--            Permite que determinadas redes tenham seus resultados comerciais
--            consolidados para um gerente específico (Apuração Comercial)
--            sem alterar a carteira/territorialidade de cm_clientes ou base_atendimento.
-- =============================================================================

BEGIN;

-- 1. Criar Tabela Mestre de Regras Especiais de Apuração Comercial
CREATE TABLE IF NOT EXISTS public.cm_regras_apuracao_comercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matriz_nome TEXT NOT NULL UNIQUE,
  gerente_apuracao TEXT NOT NULL,
  manager_id_apuracao TEXT NOT NULL,
  ativa BOOLEAN DEFAULT TRUE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & Grants para a nova tabela
ALTER TABLE public.cm_regras_apuracao_comercial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica de cm_regras_apuracao_comercial" ON public.cm_regras_apuracao_comercial;
CREATE POLICY "Leitura publica de cm_regras_apuracao_comercial"
  ON public.cm_regras_apuracao_comercial FOR SELECT
  TO authenticated, anon, service_role
  USING (true);

DROP POLICY IF EXISTS "Admin total em cm_regras_apuracao_comercial" ON public.cm_regras_apuracao_comercial;
CREATE POLICY "Admin total em cm_regras_apuracao_comercial"
  ON public.cm_regras_apuracao_comercial FOR ALL
  TO service_role
  USING (true);

GRANT SELECT ON public.cm_regras_apuracao_comercial TO authenticated, anon, service_role;
GRANT ALL ON public.cm_regras_apuracao_comercial TO service_role;

-- 2. Inserir Regra Oficial da Fase 1: REDE OBA -> Julliano (1000)
INSERT INTO public.cm_regras_apuracao_comercial (matriz_nome, gerente_apuracao, manager_id_apuracao, observacao)
VALUES ('REDE OBA', 'Julliano', '1000', 'Fase 1: Compra centralizada SP - apuração comercial unificada para Julliano')
ON CONFLICT (matriz_nome) DO UPDATE SET
  gerente_apuracao = EXCLUDED.gerente_apuracao,
  manager_id_apuracao = EXCLUDED.manager_id_apuracao,
  ativa = TRUE,
  updated_at = NOW();

-- 3. Recriar Materialized View mv_vendas_mensal com Suporte a Regras Especiais de Apuração
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_mensal CASCADE;

CREATE MATERIALIZED VIEW public.mv_vendas_mensal AS
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
      WHEN (r.manager_id_apuracao IS NOT NULL) THEN r.manager_id_apuracao
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
      WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
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
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN '1007'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN '1006'::text
      WHEN (r.manager_id_apuracao IS NOT NULL) THEN r.manager_id_apuracao
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
      WHEN (v.nome_vendedor = 'DISTRIBUIDOR'::text) THEN 'Distribuidor'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
      WHEN (v.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) THEN 'Marketplace'::text
      WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
      ELSE c.responsavel
    END, 'SEM RESPONSÁVEL'::text);

CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_mensal_uidx ON public.mv_vendas_mensal (mes, manager_id, rede, tipo_produto, uf, channel);

-- 4. Recriar Materialized View mv_vendas_cliente_mensal com Suporte a Regras Especiais de Apuração
DROP MATERIALIZED VIEW IF EXISTS public.mv_vendas_cliente_mensal CASCADE;

CREATE MATERIALIZED VIEW public.mv_vendas_cliente_mensal AS
SELECT 
  v.mes,
  v.ano,
  v.mes_num,
  v.cod_parceiro,
  v.nome_parceiro,
  COALESCE(c.matriz, v.nome_parceiro) AS rede,
  COALESCE(c.uf, 'SP'::text) AS uf,
  COALESCE(c.tipo_parceiro, 'Outros'::text) AS channel,
  COALESCE(r.manager_id_apuracao, c.manager_id, '9999'::text) AS manager_id,
  COALESCE(r.gerente_apuracao, c.responsavel, 'SEM RESPONSÁVEL'::text) AS manager,
  SUM(v.net_value) AS fat,
  SUM(v.quantity) AS qty,
  SUM(v.net_value - v.imposto - v.custo_total - v.custo_frete) AS maco,
  SUM(v.imposto) AS total_imposto,
  SUM(v.custo_total) AS total_custo,
  SUM(v.custo_frete) AS total_frete,
  SUM(v.valor_venda_futura) AS valor_venda_futura,
  SUM(v.num_vendas) AS num_vendas,
  COUNT(DISTINCT v.product) AS skus_distintos
FROM public.mv_vendas_agg v
LEFT JOIN public.cm_clientes c ON c.codigo = v.cod_parceiro::integer
LEFT JOIN public.cm_regras_apuracao_comercial r ON r.matriz_nome = c.matriz AND r.ativa = true
GROUP BY 
  v.mes, 
  v.ano, 
  v.mes_num, 
  v.cod_parceiro, 
  v.nome_parceiro, 
  COALESCE(c.matriz, v.nome_parceiro), 
  COALESCE(c.uf, 'SP'::text), 
  COALESCE(c.tipo_parceiro, 'Outros'::text), 
  COALESCE(r.manager_id_apuracao, c.manager_id, '9999'::text), 
  COALESCE(r.gerente_apuracao, c.responsavel, 'SEM RESPONSÁVEL'::text);

CREATE UNIQUE INDEX IF NOT EXISTS mv_vendas_cliente_mensal_uidx ON public.mv_vendas_cliente_mensal (mes, cod_parceiro);

-- Grants nas Views Materializadas
GRANT SELECT ON public.mv_vendas_mensal TO authenticated, anon, service_role;
GRANT SELECT ON public.mv_vendas_cliente_mensal TO authenticated, anon, service_role;

COMMIT;
