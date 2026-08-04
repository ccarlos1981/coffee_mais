-- Migration: 20260804_create_vw_clientes_sem_matriz.sql
-- Description: Cria a view de governança cadastral public.vw_clientes_sem_matriz para monitorar
--              clientes faturados que possuem gerente atribuído mas estão sem matriz/codigo_matriz.
-- Author: Coffee++ Engineering Team

CREATE OR REPLACE VIEW public.vw_clientes_sem_matriz AS
WITH faturamento_summary AS (
  SELECT 
    f.cod_parceiro,
    MAX(f.nome_parceiro) AS nome_parceiro,
    SUM(
      CASE 
        WHEN (f.cod_top)::numeric = ANY (ARRAY[1200, 1201]::numeric[]) THEN -ABS(COALESCE(f.vlr_total_liq, 0))
        ELSE COALESCE(f.vlr_total_liq, 0)
      END
    ) AS faturamento_12m,
    MAX(f.dt_faturamento) AS ultimo_faturamento
  FROM public.cm_faturamento f
  WHERE f.dt_faturamento >= (CURRENT_DATE - INTERVAL '12 months')
    AND (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
    AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
    AND (f.cod_top)::numeric = ANY (ARRAY[1100, 1117, 1200, 1201, 1703, 1713, 1723]::numeric[])
  GROUP BY f.cod_parceiro
)
SELECT 
  fs.cod_parceiro,
  fs.nome_parceiro,
  COALESCE(c.responsavel, b.manager) AS gerente,
  COALESCE(c.manager_id, b.manager_id) AS manager_id,
  COALESCE(b.canal, 'Outros') AS canal,
  c.matriz,
  c.codigo_matriz,
  ROUND(fs.faturamento_12m::numeric, 2) AS faturamento_12m,
  fs.ultimo_faturamento
FROM faturamento_summary fs
LEFT JOIN public.cm_clientes c ON c.codigo = fs.cod_parceiro::integer
LEFT JOIN public.base_atendimento b ON b.cod_parceiro = fs.cod_parceiro
WHERE (COALESCE(c.responsavel, b.manager) IS NOT NULL AND TRIM(COALESCE(c.responsavel, b.manager)) <> '')
  AND (c.matriz IS NULL OR TRIM(c.matriz) = '' OR c.codigo_matriz IS NULL)
ORDER BY fs.faturamento_12m DESC;

-- Garantir permissões de leitura para a aplicação e perfis de auditoria
GRANT SELECT ON public.vw_clientes_sem_matriz TO anon, authenticated, service_role;
