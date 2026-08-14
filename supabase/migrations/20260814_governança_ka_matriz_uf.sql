-- Migration: 20260814_governança_ka_matriz_uf.sql
-- Goal: Governança definitiva da classificação do Canal KA por MATRIZ/REDE + UF
-- Target Table: public.cm_regras_apuracao_comercial, public.cm_clientes, public.base_atendimento, public.sales

BEGIN;

-- 1. ADICIONAR COLUNAS UF E CANAL EM cm_regras_apuracao_comercial
ALTER TABLE public.cm_regras_apuracao_comercial 
ADD COLUMN IF NOT EXISTS uf text,
ADD COLUMN IF NOT EXISTS canal text DEFAULT 'KA';

-- 2. CRIAR ÍNDICE DE PROTEÇÃO CONTRA DUPLICIDADE DE REGRAS ATIVAS (MATRIZ + UF)
DROP INDEX IF EXISTS public.idx_cm_regras_matriz_uf_ativa;
CREATE UNIQUE INDEX idx_cm_regras_matriz_uf_ativa 
ON public.cm_regras_apuracao_comercial (matriz_nome, COALESCE(uf, 'ALL')) 
WHERE (ativa = true);

-- 3. CARGA E ATUALIZAÇÃO DAS 15 REGRAS DA MATRIZ KA HOMOLOGADA
-- Atualizar a regra existente REDE OBA para ter UF = SP e canal = KA
UPDATE public.cm_regras_apuracao_comercial
SET uf = 'SP', canal = 'KA', updated_at = NOW()
WHERE matriz_nome = 'REDE OBA' AND gerente_apuracao = 'Julliano';

-- Inserir/Atualizar as demais 14 regras homologadas
INSERT INTO public.cm_regras_apuracao_comercial 
  (matriz_nome, uf, gerente_apuracao, manager_id_apuracao, canal, ativa, observacao, created_at, updated_at)
VALUES
  ('ST MARCHE', 'SP', 'Julliano', '1000', 'KA', true, 'Matriz Homologada KA SP - Julliano', NOW(), NOW()),
  ('BOA', 'SP', 'Julliano', '1000', 'KA', true, 'Matriz Homologada KA SP - Julliano', NOW(), NOW()),
  ('MAMBO', 'SP', 'Julliano', '1000', 'KA', true, 'Matriz Homologada KA SP - Julliano', NOW(), NOW()),
  ('ZAFFARI', 'SP', 'Julliano', '1000', 'KA', true, 'Matriz Homologada KA SP - Julliano', NOW(), NOW()),
  ('HIPERBOM / HIPERSELECT', 'SC', 'Leandro Saffi', '1001', 'KA', true, 'Matriz Homologada KA SC - Leandro Saffi', NOW(), NOW()),
  ('FORT', 'SC', 'Leandro Saffi', '1001', 'KA', true, 'Matriz Homologada KA SC - Leandro Saffi', NOW(), NOW()),
  ('IMPERATRIZ', 'SC', 'Leandro Saffi', '1001', 'KA', true, 'Matriz Homologada KA SC - Leandro Saffi', NOW(), NOW()),
  ('ZONA SUL', 'RJ', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA RJ - Luiz', NOW(), NOW()),
  ('VERDEMAR', 'MG', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA MG - Luiz', NOW(), NOW()),
  ('ABC', 'MG', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA MG - Luiz', NOW(), NOW()),
  ('BH', 'MG', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA MG - Luiz', NOW(), NOW()),
  ('DUFRY', 'SP', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA SP - Luiz', NOW(), NOW()),
  ('MATEUS', 'PE', 'Luiz', '1002', 'KA', true, 'Matriz Homologada KA PE - Luiz', NOW(), NOW())
ON CONFLICT (matriz_nome, COALESCE(uf, 'ALL')) WHERE (ativa = true)
DO UPDATE SET
  gerente_apuracao = EXCLUDED.gerente_apuracao,
  manager_id_apuracao = EXCLUDED.manager_id_apuracao,
  canal = EXCLUDED.canal,
  updated_at = NOW();

-- 4. ATUALIZAÇÃO CADASTRAL DO PARCEIRO 225794 (MIX MATEUS PE)
-- Inserir/Atualizar em cm_clientes
INSERT INTO public.cm_clientes (
  codigo, nome_parceiro, razao_social, matriz, responsavel, tipo_parceiro, uf, manager_id, manager_name, created_at
) VALUES (
  225794, 'MIX MATEUS', 'MIX MATEUS', 'MATEUS', 'Luiz', 'KA', 'PE', '1002', 'Luiz', NOW()
) ON CONFLICT (codigo) DO UPDATE SET
  matriz = 'MATEUS',
  responsavel = 'Luiz',
  tipo_parceiro = 'KA',
  uf = 'PE',
  manager_id = '1002',
  manager_name = 'Luiz';

-- Inserir/Atualizar em base_atendimento
INSERT INTO public.base_atendimento (
  cod_parceiro, nome_parceiro, rede, manager, canal, uf, ka, manager_id
) VALUES (
  '225794', 'MIX MATEUS', 'MATEUS', 'Luiz', 'KA', 'PE', 'S', '1002'
) ON CONFLICT (cod_parceiro) DO UPDATE SET
  rede = 'MATEUS',
  manager = 'Luiz',
  canal = 'KA',
  uf = 'PE',
  ka = 'S',
  manager_id = '1002';

-- 5. RECRIAÇÃO DA VIEW public.sales COM PRECEDÊNCIA DE MATRIZ + UF DA cm_regras_apuracao_comercial
CREATE OR REPLACE VIEW public.sales AS
 SELECT (s.id)::text AS id,
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
    (s.quantity)::numeric AS quantity,
    (s.net_value)::numeric AS net_value,
    (s.vlr_unitario)::numeric AS vlr_unitario,
    (s.imposto)::numeric AS imposto,
    (s.custo_unitario)::numeric AS custo_unitario,
    (s.custo_total)::numeric AS custo_total,
    (s.discount)::numeric AS discount,
    (s.receita_frete)::numeric AS receita_frete,
    (s.custo_frete)::numeric AS custo_frete,
    (s.vlr_frete)::numeric AS vlr_frete,
    (s.vlr_substituicao)::numeric AS vlr_substituicao,
    s.cfop,
    s.seller,
    s.empresa,
    s.payment_type,
    b.nome_parceiro,
    b.rede,
    b.rede_uf AS network_uf,
    COALESCE(
        CASE
            WHEN (s.seller = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (s.seller = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            WHEN (r.canal IS NOT NULL) THEN r.canal
            ELSE b.canal
        END, 'Outros'::text) AS channel,
    COALESCE(
        CASE
            WHEN (s.seller = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (s.seller = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
            ELSE b.manager
        END, 'Outros'::text) AS manager,
    b.uf,
    b.regional,
    b.ka,
    (((COALESCE(s.net_value, (0)::double precision) - COALESCE(s.imposto, (0)::double precision)) - COALESCE(s.custo_total, (0)::double precision)))::numeric AS maco,
    COALESCE(
        CASE
            WHEN (s.seller = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN '1005'::character varying
            WHEN (s.seller = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN '1006'::character varying
            WHEN (r.manager_id_apuracao IS NOT NULL) THEN (r.manager_id_apuracao)::character varying
            ELSE b.manager_id
        END, '9999'::character varying) AS manager_id
   FROM ((sales_v2 s
     LEFT JOIN base_atendimento b ON ((s.cod_parceiro = b.cod_parceiro)))
     LEFT JOIN cm_regras_apuracao_comercial r ON (((r.matriz_nome = b.rede) AND ((r.uf IS NULL) OR (r.uf = b.uf)) AND (r.ativa = true))))
  WHERE (s.invoice_date < '2025-01-01'::date)
UNION ALL
 SELECT (f.id)::text AS id,
    ((((f.nro_nota || '|'::text) || f.cod_produto) || '|'::text) || f.cod_parceiro) AS chave,
    f.dt_faturamento AS invoice_date,
    (EXTRACT(year FROM f.dt_faturamento))::integer AS ano,
    (EXTRACT(month FROM f.dt_faturamento))::integer AS mes,
    (EXTRACT(day FROM f.dt_faturamento))::integer AS dia,
    to_char((f.dt_faturamento)::timestamp with time zone, 'YYYY_MM'::text) AS ano_mes,
    f.nro_nota AS invoice_number,
    f.nro_unico AS unique_number,
    f.cod_parceiro,
    f.cod_produto,
    f.desc_produto AS product,
        CASE
            WHEN (upper(f.desc_produto) ~~ '%1KG%'::text) THEN '1 KG'::text
            WHEN ((upper(f.desc_produto) ~~ '%5KG%'::text) OR (upper(f.desc_produto) ~~ '%5 KG%'::text)) THEN '5 KG'::text
            WHEN ((upper(f.desc_produto) ~~ '%CAPSULA%'::text) OR (upper(f.desc_produto) ~~ '%CÁPSULA%'::text)) THEN 'Cápsula'::text
            WHEN (upper(f.desc_produto) ~~ '%DRIP%'::text) THEN 'Drip'::text
            WHEN (upper(f.desc_produto) ~~ '%GEISHA%'::text) THEN 'Geisha'::text
            WHEN (upper(f.desc_produto) ~~ '%VERDE%'::text) THEN 'Café Verde'::text
            WHEN ((upper(f.desc_produto) ~~ '%GRAO%'::text) OR (upper(f.desc_produto) ~~ '%GRÃO%'::text)) THEN 'Grão'::text
            WHEN ((upper(f.desc_produto) ~~ '%MOIDO%'::text) OR (upper(f.desc_produto) ~~ '%MOÍDO%'::text)) THEN 'Moído'::text
            WHEN ((upper(f.desc_produto) ~~ '%ACESSORIO%'::text) OR (upper(f.desc_produto) ~~ '%GARRAFA%'::text) OR (upper(f.desc_produto) ~~ '%CANECA%'::text) OR (upper(f.desc_produto) ~~ '%KIT%'::text)) THEN 'Acessório'::text
            ELSE 'Outros'::text
        END AS tipo_produto,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.quantidade, (0)::numeric)))
            ELSE COALESCE(f.quantidade, (0)::numeric)
        END AS quantity,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
            ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
        END AS net_value,
    f.vlr_unitario,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))))
            ELSE (COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))
        END AS imposto,
    (f.custo_total / NULLIF(f.quantidade, (0)::numeric)) AS custo_unitario,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
            ELSE COALESCE(f.custo_total, (0)::numeric)
        END AS custo_total,
    f.vlr_desconto AS discount,
    f.vlr_frete AS receita_frete,
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_frete, (0)::numeric)))
            ELSE COALESCE(f.vlr_frete, (0)::numeric)
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
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            ELSE b.rede
        END, f.nome_parceiro, 'Não Mapeado'::text) AS rede,
    b.rede_uf AS network_uf,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            WHEN (r.canal IS NOT NULL) THEN r.canal
            ELSE b.canal
        END, 'Outros'::text) AS channel,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN 'Ecommerce'::text
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'Marketplace'::text
            WHEN (r.gerente_apuracao IS NOT NULL) THEN r.gerente_apuracao
            ELSE b.manager
        END, 'Outros'::text) AS manager,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN 'SP'::text
            ELSE b.uf
        END, 'SP'::text) AS uf,
    b.uf AS regional,
    b.ka,
    ((
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.vlr_total_liq, (0)::numeric)))
            ELSE COALESCE(f.vlr_total_liq, (0)::numeric)
        END -
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs((COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))))
            ELSE (COALESCE(f.custo_icms, (0)::numeric) + COALESCE(f.vlr_total_st, (0)::numeric))
        END) -
        CASE
            WHEN (f.cod_top = ANY (ARRAY['1200'::text, '1201'::text])) THEN (- abs(COALESCE(f.custo_total, (0)::numeric)))
            ELSE COALESCE(f.custo_total, (0)::numeric)
        END) AS maco,
    COALESCE(
        CASE
            WHEN (f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text])) THEN ('1005'::text)::character varying
            WHEN (f.nome_vendedor = ANY (ARRAY['AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text])) THEN ('1006'::text)::character varying
            WHEN (r.manager_id_apuracao IS NOT NULL) THEN (r.manager_id_apuracao)::character varying
            ELSE b.manager_id
        END, ('9999'::text)::character varying) AS manager_id
   FROM ((cm_faturamento f
     LEFT JOIN base_atendimento b ON ((b.cod_parceiro = f.cod_parceiro)))
     LEFT JOIN cm_regras_apuracao_comercial r ON (((r.matriz_nome = b.rede) AND ((r.uf IS NULL) OR (r.uf = b.uf)) AND (r.ativa = true))))
  WHERE ((f.dt_faturamento IS NOT NULL) AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text)) AND (f.nome_parceiro <> 'CAFE UTAM S/A'::text) AND (f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text) AND (((f.nome_vendedor = ANY (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1723)::numeric, (1117)::numeric, (1703)::numeric]))) OR ((f.nome_vendedor <> ALL (ARRAY['SHOPIFY'::text, 'LIVELO'::text, 'AMAZONFBA'::text, 'MELI FULL'::text, 'SHOPEE'::text, 'AMAZONBR'::text, 'ANYMARKET'::text, 'MAGALU'::text, 'MELI'::text])) AND ((f.cod_top)::numeric = ANY (ARRAY[(1100)::numeric, (1200)::numeric, (1201)::numeric, (1713)::numeric, (1117)::numeric, (1703)::numeric])) AND ((b.manager IS NULL) OR (b.manager <> ALL (ARRAY['Ecommerce'::text, 'Marketplace'::text]))))));

COMMIT;
