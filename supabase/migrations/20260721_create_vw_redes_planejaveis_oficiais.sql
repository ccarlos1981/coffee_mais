-- Migration: Create vw_redes_planejaveis_oficiais view
-- Author: Coffee++ Advanced Agentic Coding
-- Date: 2026-07-21

CREATE OR REPLACE VIEW public.vw_redes_planejaveis_oficiais AS
WITH base_grouped AS (
  SELECT 
    TRIM(b.rede) AS rede,
    b.manager,
    COALESCE(b.manager_id, '9999') AS manager_id,
    COALESCE(b.canal, 'Outros') AS canal,
    b.ka,
    COALESCE(b.is_star, FALSE) AS is_star,
    b.regional,
    b.uf,
    COUNT(DISTINCT b.cod_parceiro) AS total_pdvs_vinculados,
    MAX(c.codigo_matriz) AS codigo_matriz
  FROM public.base_atendimento b
  LEFT JOIN public.cm_clientes c 
    ON UPPER(TRIM(c.matriz)) = UPPER(TRIM(b.rede))
  WHERE b.rede IS NOT NULL 
    AND TRIM(b.rede) != ''
    AND UPPER(TRIM(b.rede)) != 'NÃO MAPEADO'
    AND UPPER(TRIM(b.rede)) != 'OUTROS'
  GROUP BY 
    TRIM(b.rede),
    b.manager,
    COALESCE(b.manager_id, '9999'),
    COALESCE(b.canal, 'Outros'),
    b.ka,
    COALESCE(b.is_star, FALSE),
    b.regional,
    b.uf
),
base_summary AS (
  SELECT 
    bg.*,
    EXISTS (
      SELECT 1 FROM public.cm_acoes_investimento ai 
      WHERE UPPER(TRIM(ai.rede)) = UPPER(bg.rede)
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
       OR s.ka IS NOT NULL 
       OR s.is_star = TRUE 
       OR s.possui_investimento_trade = TRUE
     )
    THEN TRUE
    ELSE FALSE
  END AS is_rede_planejavel
FROM base_summary s;
