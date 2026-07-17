-- Migration: 20260717_clientes_faturamento_promocao_realtime.sql
-- Description: Criar View Padrão de promoção de clientes em tempo real (excluindo canais de e-commerce/retail).

CREATE OR REPLACE VIEW public.vw_clientes_faturamento_promocao AS
WITH B2B_faturamento AS (
  SELECT f.cod_parceiro, f.nome_parceiro, f.dt_faturamento
  FROM public.cm_faturamento f
  WHERE f.dt_faturamento IS NOT NULL
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA'::text)
    AND f.nome_parceiro <> 'CAFE UTAM S/A'::text
    AND f.nome_parceiro <> 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text
    AND f.cod_parceiro IS NOT NULL
    AND f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI', 'MAGALU FULL')
),
distinct_B2B AS (
  SELECT DISTINCT ON (cod_parceiro)
    cod_parceiro,
    nome_parceiro
  FROM B2B_faturamento
  ORDER BY cod_parceiro, dt_faturamento DESC
)
SELECT db.cod_parceiro, db.nome_parceiro
FROM distinct_B2B db
WHERE NOT EXISTS (
  SELECT 1 FROM public.cm_clientes c
  WHERE c.codigo = db.cod_parceiro::integer
);

-- Permissões
GRANT SELECT ON public.vw_clientes_faturamento_promocao TO anon, authenticated, service_role;
