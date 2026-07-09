-- Migration para Sprint 7: Funções de Observabilidade, Integridade e Views de Métricas

BEGIN;

-- 0. Helper para calcular o valor total planejado de uma ação (incluindo SKUs)
CREATE OR REPLACE FUNCTION public.get_acao_valor_total(a public.cm_acoes_investimento)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC := 0;
    v_sku JSONB;
BEGIN
    IF a.abrangencia = 'SKU' AND a.skus_detalhes IS NOT NULL AND jsonb_array_length(a.skus_detalhes) > 0 THEN
        FOR v_sku IN SELECT * FROM jsonb_array_elements(a.skus_detalhes) LOOP
            v_total := v_total + (COALESCE((v_sku->>'investimento')::numeric, 0) * COALESCE((v_sku->>'expectativa_volume')::numeric, 0));
        END LOOP;
        RETURN v_total;
    END IF;
    RETURN COALESCE(a.valor_investimento, 0) * COALESCE(a.expectativa_volume, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Função de Integridade e Auditoria de Investimentos (Somente Leitura)
CREATE OR REPLACE FUNCTION public.check_investimentos_integrity()
RETURNS TABLE (
    tipo_inconsistencia TEXT,
    origem_id UUID,
    origem_tabela TEXT,
    detalhes TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- A. Campanhas sem ações vinculadas
    SELECT 
        'campanha_sem_acoes'::TEXT AS tipo_inconsistencia,
        c.id AS origem_id,
        'cm_campanhas'::TEXT AS origem_tabela,
        'Campanha "' || c.nome_campanha || '" (' || COALESCE(c.codigo_campanha, 'Sem Código') || ') não possui nenhuma ação vinculada.'::TEXT AS detalhes
    FROM public.cm_campanhas c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cm_acoes_investimento a WHERE a.campanha_id = c.id
    )

    UNION ALL

    -- B. Ações com referência de campanha inexistente
    SELECT 
        'acao_campanha_inexistente'::TEXT AS tipo_inconsistencia,
        a.id AS origem_id,
        'cm_acoes_investimento'::TEXT AS origem_tabela,
        'Ação com ID campanha_id (' || a.campanha_id || ') inexistente no cadastro de campanhas.'::TEXT AS detalhes
    FROM public.cm_acoes_investimento a
    LEFT JOIN public.cm_campanhas c ON a.campanha_id = c.id
    WHERE a.campanha_id IS NOT NULL AND c.id IS NULL

    UNION ALL

    -- C. Campanhas quitadas com saldo financeiro pendente
    SELECT 
        'campanha_quitada_saldo_pendente'::TEXT AS tipo_inconsistencia,
        c.id AS origem_id,
        'cm_campanhas'::TEXT AS origem_tabela,
        'Campanha quitada com saldo divergente (Homologado: R$ ' || round(COALESCE(vals.valor_homologado, 0), 2) || ', Pago: R$ ' || round(COALESCE(vals.valor_pago, 0), 2) || ')'::TEXT AS detalhes
    FROM public.cm_campanhas c
    LEFT JOIN LATERAL (
        SELECT 
            SUM(CASE WHEN a.fase_atual >= 3 THEN public.get_acao_valor_total(a) ELSE 0 END) AS valor_homologado,
            SUM(CASE WHEN a.fase_atual = 6 OR a.status_financeiro = 'QUITADA' THEN COALESCE(a.apuracao_valor_realizado, public.get_acao_valor_total(a)) ELSE 0 END) AS valor_pago
        FROM public.cm_acoes_investimento a
        WHERE a.campanha_id = c.id
    ) vals ON TRUE
    WHERE c.status_financeiro = 'QUITADA' AND ABS(COALESCE(vals.valor_homologado, 0) - COALESCE(vals.valor_pago, 0)) > 0.01

    UNION ALL

    -- D. Campanhas quitadas contendo ações ainda em fases iniciais (Planejamento ou Validação)
    SELECT DISTINCT ON (c.id)
        'campanha_quitada_acoes_iniciais'::TEXT AS tipo_inconsistencia,
        c.id AS origem_id,
        'cm_campanhas'::TEXT AS origem_tabela,
        'Campanha está quitada mas possui ação em andamento/fase inicial (Ação ID: ' || a.id || ', Fase: ' || a.fase_atual || ')'::TEXT AS detalhes
    FROM public.cm_campanhas c
    JOIN public.cm_acoes_investimento a ON a.campanha_id = c.id
    WHERE c.status_financeiro = 'QUITADA' AND a.fase_atual IN (1, 2)

    UNION ALL

    -- E. Ações sem status financeiro definido
    SELECT 
        'acao_sem_status_financeiro'::TEXT AS tipo_inconsistencia,
        a.id AS origem_id,
        'cm_acoes_investimento'::TEXT AS origem_tabela,
        'Ação da rede "' || a.rede || '" está com status financeiro nulo.'::TEXT AS detalhes
    FROM public.cm_acoes_investimento a
    WHERE a.status_financeiro IS NULL

    UNION ALL

    -- F. Códigos de campanha duplicados
    SELECT 
        'codigo_campanha_duplicado'::TEXT AS tipo_inconsistencia,
        c.id AS origem_id,
        'cm_campanhas'::TEXT AS origem_tabela,
        'Código de campanha duplicado: ' || c.codigo_campanha::TEXT AS detalhes
    FROM public.cm_campanhas c
    WHERE c.codigo_campanha IS NOT NULL AND c.codigo_campanha IN (
        SELECT sub.codigo_campanha 
        FROM public.cm_campanhas sub 
        GROUP BY sub.codigo_campanha 
        HAVING COUNT(*) > 1
    )

    UNION ALL

    -- G. Inconsistência entre valor homologado e valor pago em ações quitadas
    SELECT 
        'homologado_diferente_pago'::TEXT AS tipo_inconsistencia,
        a.id AS origem_id,
        'cm_acoes_investimento'::TEXT AS origem_tabela,
        'Ação quitada com valor realizado (R$ ' || COALESCE(a.apuracao_valor_realizado, 0) || ') divergente do valor planejado/homologado (R$ ' || public.get_acao_valor_total(a) || ')'::TEXT AS detalhes
    FROM public.cm_acoes_investimento a
    WHERE (a.fase_atual = 6 OR a.status_financeiro = 'QUITADA')
      AND ABS(COALESCE(a.apuracao_valor_realizado, 0) - public.get_acao_valor_total(a)) > 0.01

    UNION ALL

    -- H. Inconsistência de faturamento (Fase >= 5 sem faturamento real preenchido)
    SELECT 
        'inconsistencia_faturamento'::TEXT AS tipo_inconsistencia,
        a.id AS origem_id,
        'cm_acoes_investimento'::TEXT AS origem_tabela,
        'Ação finalizada na fase ' || a.fase_atual || ' com faturamento real nulo ou zerado.'::TEXT AS detalhes
    FROM public.cm_acoes_investimento a
    WHERE a.fase_atual >= 5 AND (a.real_faturamento IS NULL OR a.real_faturamento = 0)

    UNION ALL

    -- I. Inconsistência de ROI (Fase >= 5 sem ROI válido preenchido)
    SELECT 
        'inconsistencia_roi'::TEXT AS tipo_inconsistencia,
        a.id AS origem_id,
        'cm_acoes_investimento'::TEXT AS origem_tabela,
        'Ação finalizada na fase ' || a.fase_atual || ' com ROI nulo, negativo ou zerado (ROI: ' || COALESCE(a.roi::text, 'nulo') || ').'::TEXT AS detalhes
    FROM public.cm_acoes_investimento a
    WHERE a.fase_atual >= 5 AND (a.roi IS NULL OR a.roi <= 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Views Auxiliares de Métricas

-- A. Tempo médio de ciclo (em dias)
CREATE OR REPLACE VIEW public.v_metrics_tempo_ciclo AS
SELECT 
    AVG(EXTRACT(EPOCH FROM (trade_validado_em - created_at)) / 86400)::numeric(10,2) AS tempo_medio_aprovacao_dias,
    AVG(EXTRACT(EPOCH FROM (data_inicio::timestamp - trade_validado_em)) / 86400)::numeric(10,2) AS tempo_medio_execucao_dias,
    AVG(EXTRACT(EPOCH FROM (financeiro_pago_em - data_fim::timestamp)) / 86400)::numeric(10,2) AS tempo_medio_quitacao_dias
FROM public.cm_acoes_investimento
WHERE is_planejamento = false;

-- B. ROI médio por campanha
CREATE OR REPLACE VIEW public.v_metrics_roi_campanha AS
SELECT 
    c.id AS campanha_id,
    c.nome_campanha,
    c.codigo_campanha,
    AVG(a.roi)::numeric(10,2) AS roi_medio,
    COUNT(a.id) AS qtd_acoes
FROM public.cm_campanhas c
JOIN public.cm_acoes_investimento a ON a.campanha_id = c.id
WHERE a.roi IS NOT NULL
GROUP BY c.id, c.nome_campanha, c.codigo_campanha;

-- C. ROI médio por rede
CREATE OR REPLACE VIEW public.v_metrics_roi_rede AS
SELECT 
    a.rede,
    AVG(a.roi)::numeric(10,2) AS roi_medio,
    COUNT(a.id) AS qtd_acoes
FROM public.cm_acoes_investimento a
WHERE a.roi IS NOT NULL
GROUP BY a.rede;

-- D. ROI médio por família
CREATE OR REPLACE VIEW public.v_metrics_roi_familia AS
SELECT 
    a.familia_produto AS familia,
    AVG(a.roi)::numeric(10,2) AS roi_medio,
    COUNT(a.id) AS qtd_acoes
FROM public.cm_acoes_investimento a
WHERE a.roi IS NOT NULL AND a.familia_produto IS NOT NULL
GROUP BY a.familia_produto;

-- E. Helper RPCs para Dashboard de Observabilidade

CREATE OR REPLACE FUNCTION public.get_campanhas_criadas_por_dia()
RETURNS TABLE(dia DATE, qtd BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT created_at::date AS dia, COUNT(*) AS qtd
    FROM public.cm_campanhas
    GROUP BY created_at::date
    ORDER BY created_at::date DESC
    LIMIT 15;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_media_acoes_por_campanha()
RETURNS NUMERIC AS $$
DECLARE
    v_media NUMERIC;
BEGIN
    SELECT (COUNT(a.id)::float / GREATEST(COUNT(DISTINCT c.id), 1))::numeric(10,2)
    INTO v_media
    FROM public.cm_campanhas c
    LEFT JOIN public.cm_acoes_investimento a ON a.campanha_id = c.id;
    RETURN v_media;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_campanhas_orfas_count()
RETURNS BIGINT AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.cm_campanhas c
    WHERE NOT EXISTS (
        SELECT 1 FROM public.cm_acoes_investimento a WHERE a.campanha_id = c.id
    );
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_divergencias_financeiras_count()
RETURNS BIGINT AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.cm_acoes_investimento a
    WHERE (a.fase_atual = 6 OR a.status_financeiro = 'QUITADA')
      AND ABS(COALESCE(a.apuracao_valor_realizado, 0) - public.get_acao_valor_total(a)) > 0.01;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
