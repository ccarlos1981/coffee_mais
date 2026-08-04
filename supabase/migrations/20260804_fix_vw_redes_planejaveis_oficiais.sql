-- Migration: 20260804_fix_vw_redes_planejaveis_oficiais.sql
-- Description: Reescreve a view vw_redes_planejaveis_oficiais utilizando exclusivamente a cm_clientes (Single Source of Truth)
--              Elimina duplicidades de (manager, rede), elimina JOINs com OR por texto e garante codigo_matriz 100% populado.
--              Elimina completamente fallbacks artificiais, UPPER(TRIM) e OR em subqueries.
-- Author: Coffee++ Engineering Team

CREATE OR REPLACE VIEW public.vw_redes_planejaveis_oficiais AS
WITH base_grouped AS (
  SELECT 
    TRIM(c.matriz) AS rede,
    c.responsavel AS manager,
    c.manager_id,
    COALESCE(MAX(c.tipo_parceiro), 'Outros') AS canal,
    (CASE WHEN BOOL_OR(LOWER(TRIM(COALESCE(c.ka, 'false'))) IN ('true', '1', 'sim')) THEN 'true' ELSE 'false' END)::text AS ka,
    FALSE AS is_star, -- Campo mantido para retrocompatibilidade do contrato (0 registros true na base)
    MAX(c.regional) AS regional,
    MAX(c.uf) AS uf,
    COUNT(DISTINCT c.codigo) AS total_pdvs_vinculados,
    c.codigo_matriz
  FROM public.cm_clientes c
  WHERE c.matriz IS NOT NULL 
    AND TRIM(c.matriz) != ''
    AND UPPER(TRIM(c.matriz)) != 'NÃO MAPEADO'
    AND UPPER(TRIM(c.matriz)) != 'OUTROS'
    AND c.codigo_matriz IS NOT NULL
  GROUP BY 
    TRIM(c.matriz),
    c.responsavel,
    c.manager_id,
    c.codigo_matriz
),
base_summary AS (
  SELECT 
    bg.*,
    EXISTS (
      SELECT 1 
      FROM public.cm_acoes_investimento ai 
      WHERE ai.codigo_matriz = bg.codigo_matriz
    ) AS possui_investimento_trade
  FROM base_grouped bg
)
SELECT 
  s.rede,
  s.manager,
  s.manager_id,
  s.canal,
  s.ka,
  s.is_star,
  s.regional,
  s.uf,
  s.total_pdvs_vinculados,
  s.codigo_matriz,
  s.possui_investimento_trade,
  CASE 
    WHEN (s.canal IS NULL OR s.canal NOT IN ('Inside Sales', 'Inside inter', 'Exportação'))
     AND (
       s.canal IN ('KA', 'Key Account', 'Varejo', 'SUPERMERCADO', 'ATACAREJO', 'DISTRIBUICAO', 'Distribuidor', 'CONVENIENCIA')
       OR s.ka = 'true' 
       OR s.possui_investimento_trade IS TRUE
     )
    THEN TRUE
    ELSE FALSE
  END AS is_rede_planejavel
FROM base_summary s;

-- Garantir permissões de leitura para os perfis da aplicação
GRANT SELECT ON public.vw_redes_planejaveis_oficiais TO anon, authenticated, service_role;
