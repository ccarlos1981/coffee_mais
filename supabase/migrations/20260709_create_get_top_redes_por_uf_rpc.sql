-- ============================================================
-- Migration: Create RPC to fetch top networks by state (UF) based on recent sales (12 months)
-- Date: 07/09/2026
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_top_redes_por_uf(p_uf TEXT)
RETURNS TABLE (
    codigo_matriz TEXT,
    nome TEXT,
    canal TEXT,
    faturamento_total NUMERIC,
    volume_total NUMERIC,
    lojas_positivadas BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
    row_count INT;
BEGIN
    IF p_uf IS NOT NULL AND p_uf <> '' THEN
        RETURN QUERY
        SELECT 
            c.codigo_matriz, 
            MAX(c.matriz) AS nome,
            MAX(c.tipo_parceiro) AS canal,
            COALESCE(SUM(s.net_value), 0) AS faturamento_total,
            COALESCE(SUM(s.quantity), 0) AS volume_total,
            COUNT(DISTINCT s.cod_parceiro)::BIGINT AS lojas_positivadas
        FROM public.cm_clientes c
        LEFT JOIN public.sales s ON (c.codigo)::text = s.cod_parceiro AND s.invoice_date >= NOW() - INTERVAL '12 months'
        WHERE c.codigo_matriz IS NOT NULL
          AND c.uf = p_uf
        GROUP BY c.codigo_matriz
        ORDER BY faturamento_total DESC, volume_total DESC, lojas_positivadas DESC
        LIMIT 10;
        
        GET DIAGNOSTICS row_count = ROW_COUNT;
        
        IF row_count = 0 THEN
            RETURN QUERY
            SELECT 
                c.codigo_matriz, 
                MAX(c.matriz) AS nome,
                MAX(c.tipo_parceiro) AS canal,
                COALESCE(SUM(s.net_value), 0) AS faturamento_total,
                COALESCE(SUM(s.quantity), 0) AS volume_total,
                COUNT(DISTINCT s.cod_parceiro)::BIGINT AS lojas_positivadas
            FROM public.cm_clientes c
            LEFT JOIN public.sales s ON (c.codigo)::text = s.cod_parceiro AND s.invoice_date >= NOW() - INTERVAL '12 months'
            WHERE c.codigo_matriz IS NOT NULL
            GROUP BY c.codigo_matriz
            ORDER BY faturamento_total DESC, volume_total DESC, lojas_positivadas DESC
            LIMIT 10;
        END IF;
    ELSE
        RETURN QUERY
        SELECT 
            c.codigo_matriz, 
            MAX(c.matriz) AS nome,
            MAX(c.tipo_parceiro) AS canal,
            COALESCE(SUM(s.net_value), 0) AS faturamento_total,
            COALESCE(SUM(s.quantity), 0) AS volume_total,
            COUNT(DISTINCT s.cod_parceiro)::BIGINT AS lojas_positivadas
        FROM public.cm_clientes c
        LEFT JOIN public.sales s ON (c.codigo)::text = s.cod_parceiro AND s.invoice_date >= NOW() - INTERVAL '12 months'
        WHERE c.codigo_matriz IS NOT NULL
        GROUP BY c.codigo_matriz
        ORDER BY faturamento_total DESC, volume_total DESC, lojas_positivadas DESC
        LIMIT 10;
    END IF;
END;
$$;

-- Security Hardening: Restrict execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.get_top_redes_por_uf(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_redes_por_uf(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_redes_por_uf(TEXT) TO service_role;

