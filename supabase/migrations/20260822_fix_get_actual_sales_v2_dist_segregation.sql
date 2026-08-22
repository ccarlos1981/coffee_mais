-- Migration: 20260822_fix_get_actual_sales_v2_dist_segregation.sql
-- Description: Correção cirúrgica na RPC get_actual_sales_v2 para suportar segregação por Gerente no canal Distribuidor.

CREATE OR REPLACE FUNCTION public.get_actual_sales_v2(
  p_channel text, 
  p_manager_id text, 
  p_manager_name text, 
  p_years text[]
)
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
      -- 1. Toda Empresa: consolida todos os canais e gerentes
      p_channel = 'Toda Empresa'
      OR (
        -- 2. Canal KA: filtra por canal e opcionalmente por gerente
        p_channel = 'KA' 
        AND m.channel = 'KA' 
        AND (
          ((p_manager_id IS NOT NULL AND p_manager_id <> '' AND (p_manager_id = 'Total' OR m.manager_id = p_manager_id))
          OR
          ((p_manager_id IS NULL OR p_manager_id = '') AND (p_manager_name = 'Total' OR m.manager = p_manager_name)))
        )
      )
      OR (
        -- 3. Canal Distribuidor: filtra por canal e opcionalmente por gerente
        p_channel = 'Distribuidor'
        AND m.channel = 'Distribuidor'
        AND (
          ((p_manager_id IS NOT NULL AND p_manager_id <> '' AND (p_manager_id = 'Total' OR m.manager_id = p_manager_id))
          OR
          ((p_manager_id IS NULL OR p_manager_id = '') AND (p_manager_name = 'Total' OR m.manager = p_manager_name)))
        )
      )
      OR (
        -- 4. Demais canais corporativos sem carteira gerencial
        p_channel NOT IN ('Toda Empresa', 'KA', 'Distribuidor')
        AND m.channel = p_channel
      )
    )
  GROUP BY m.ano, m.mes_num;
END;
$$;

-- Recriar overload de 3 parâmetros chamando a versão canônica
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
