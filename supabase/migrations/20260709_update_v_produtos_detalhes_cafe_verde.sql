-- 1. Drop existing view to avoid issues with definition replacements
DROP VIEW IF EXISTS public.v_produtos_detalhes CASCADE;

-- 2. Create the view with Cafe Verde support
CREATE OR REPLACE VIEW public.v_produtos_detalhes AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.line AS product_line,
    CASE 
        WHEN p.line = 'Café Verde' THEN 'Café Verde'
        ELSE p.type
    END AS product_type,
    p.weight AS product_weight_desc,
    p.active AS product_active,
    c.id AS conversao_id,
    c.codigo_integracao,
    COALESCE(c.peso_embalagem_kg, (0)::numeric) AS peso_embalagem_kg,
    COALESCE(c.unidades_por_caixa, 1) AS unidades_por_caixa,
    COALESCE((c.peso_embalagem_kg * (c.unidades_por_caixa)::numeric), (0)::numeric) AS peso_total_caixa_kg,
    c.unidade_medida,
    c.caixas_por_pallet,
    c.weight_pallet_kg AS peso_pallet_kg,
    c.vigencia_inicio,
    c.vigencia_fim,
    c.observacao,
    c.motivo_alteracao,
    COALESCE(c.ativo, false) AS conversao_ativa
FROM public.products p
LEFT JOIN public.cm_skus_conversao c ON p.id = c.product_id;
