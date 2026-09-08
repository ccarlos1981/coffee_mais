-- Migration: 20260907_gate_5_15b_fix_get_acao_valor_total.sql
-- Objetivo: Alinhar public.get_acao_valor_total ao Contrato Canônico Gate 5.15B
-- Regra: valor_investimento é o TOTAL financeiro soberano da ação (nunca multiplicado por expectativa_volume).
-- Elimina falsos positivos na RPC check_investimentos_integrity().

CREATE OR REPLACE FUNCTION public.get_acao_valor_total(a public.cm_acoes_investimento)
RETURNS NUMERIC AS $$
BEGIN
    -- 1. Se valor_investimento estiver preenchido e for maior que zero, ele é o total soberano
    IF a.valor_investimento IS NOT NULL AND a.valor_investimento > 0 THEN
        RETURN a.valor_investimento;
    END IF;

    -- 2. Fallback para registros legados por SKU onde valor_investimento não foi preenchido
    IF a.abrangencia = 'SKU' AND a.skus_detalhes IS NOT NULL AND jsonb_array_length(a.skus_detalhes) > 0 THEN
        RETURN (
            SELECT COALESCE(SUM(COALESCE((v_sku->>'investimento')::numeric, 0) * COALESCE((v_sku->>'expectativa_volume')::numeric, 0)), 0)
            FROM jsonb_array_elements(a.skus_detalhes) AS v_sku
        );
    END IF;

    -- 3. Fallback para registros legados por Família onde valor_investimento não foi preenchido
    IF a.familias_detalhes IS NOT NULL AND jsonb_array_length(a.familias_detalhes) > 0 THEN
        RETURN (
            SELECT COALESCE(SUM(COALESCE((v_fam->>'investimento')::numeric, 0) * COALESCE((v_fam->>'expectativa_volume')::numeric, 0)), 0)
            FROM jsonb_array_elements(a.familias_detalhes) AS v_fam
        );
    END IF;

    -- 4. Fallback final: retorna valor_investimento direto (ou zero)
    RETURN COALESCE(a.valor_investimento, 0);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_acao_valor_total(public.cm_acoes_investimento) IS 
'Retorna o valor financeiro total da ação comercial em conformidade com o Contrato Canônico Gate 5.15B (valor_investimento = TOTAL).';
