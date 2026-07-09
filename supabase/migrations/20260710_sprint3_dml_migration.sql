-- Migration para Sprint 3: Migração DML de Dados Ativos (Fases 1 e 2)

BEGIN;

-- 1. Desativar temporariamente as triggers de sincronização
ALTER TABLE public.cm_acoes_investimento DISABLE TRIGGER trg_sync_insert_parent_to_child;
ALTER TABLE public.cm_investimento_familias DISABLE TRIGGER trg_sync_child_to_parent_legacy;
ALTER TABLE public.cm_investimento_familias DISABLE TRIGGER trg_sync_checklists_to_parent_legacy;

-- 2. Criar tabela temporária de mapeamento de campanha (Mapeamento 1-para-1 exato)
CREATE TEMP TABLE tmp_campanha_map AS
SELECT 
    id AS acao_original_id,
    gen_random_uuid() AS novo_campanha_id
FROM public.cm_acoes_investimento
WHERE fase_atual IN (1, 2);

-- 3. Inserir em cm_campanhas usando os UUIDs pré-gerados
INSERT INTO public.cm_campanhas (id, nome_campanha, rede, codigo_matriz, mes_referencia)
SELECT 
    m.novo_campanha_id,
    'Campanha ' || a.rede || ' - ' || a.mes_referencia || ' - ' || a.id::text AS nome_campanha,
    a.rede,
    a.codigo_matriz,
    a.mes_referencia
FROM public.cm_acoes_investimento a
JOIN tmp_campanha_map m ON a.id = m.acao_original_id;

-- 4. Criar tabela temporária para mapear as novas ações desmembradas por família
CREATE TEMP TABLE tmp_acao_map (
    acao_original_id UUID,
    familia_nome TEXT,
    campanha_id UUID,
    nova_acao_id UUID
);

-- 5. Criar novas ações desmembradas copiando checklists e progresso operacional (Família + SKU)
WITH insercao_acoes AS (
    INSERT INTO public.cm_acoes_investimento (
        campanha_id,
        rede,
        codigo_matriz,
        data_inicio,
        data_fim,
        date_mode,
        tipo_acao,
        tipo_acao_detalhe,
        familia_produto,
        familias_detalhes,
        preco_flat,
        preco_acao,
        valor_investimento,
        expectativa_volume,
        abrangencia,
        tipo_pagamento,
        skus_detalhes,
        mes_referencia,
        fase_atual,
        is_planejamento,
        alertas_preventivos,
        status_financeiro,
        -- Checklists e auditoria copiados do progresso histórico
        checklist_comunicacao,
        checklist_logistica,
        checklist_auditoria,
        checklist_conferencia,
        evidencias_urls,
        trade_validado_por,
        trade_validado_em
    )
    -- PARTE 1: Ações baseadas em Família (familias_detalhes preenchido)
    SELECT 
        m.novo_campanha_id AS campanha_id,
        a.rede,
        a.codigo_matriz,
        COALESCE(f_child.data_execucao, (f->>'start_date')::date, (f->>'data_execucao')::date, a.data_inicio) AS data_inicio,
        COALESCE(f_child.data_execucao, (f->>'end_date')::date, (f->>'data_execucao')::date, a.data_fim) AS data_fim,
        'single'::text AS date_mode,
        a.tipo_acao,
        a.tipo_acao_detalhe,
        COALESCE(f_child.familia, f->>'familia_nome', f->>'familia_id') AS familia_produto,
        jsonb_build_array(f) AS familias_detalhes, -- Array unitário
        COALESCE(f_child.preco_flat, (f->>'preco_flat')::numeric, 0) AS preco_flat,
        COALESCE(f_child.preco_acao, (f->>'preco_acao')::numeric, 0) AS preco_acao,
        COALESCE(f_child.investimento, (f->>'investimento')::numeric, 0) AS valor_investimento,
        COALESCE(f_child.expectativa_volume, (f->>'expectativa_volume')::numeric, 0) AS expectativa_volume,
        CASE WHEN a.abrangencia = 'SKU' THEN 'SKU'::text ELSE 'Família'::text END AS abrangencia,
        a.tipo_pagamento,
        a.skus_detalhes,
        a.mes_referencia,
        a.fase_atual,
        a.is_planejamento,
        a.alertas_preventivos,
        'NAO_FATURADA' AS status_financeiro,
        -- Preservação de progresso operacional e checklists com suporte a NULL
        COALESCE(f_child.checklist_comunicacao, false) AS checklist_comunicacao,
        COALESCE(f_child.checklist_logistica, false) AS checklist_logistica,
        COALESCE(f_child.checklist_auditoria, false) AS checklist_auditoria,
        COALESCE(f_child.checklist_conferencia, false) AS checklist_conferencia,
        COALESCE(f_child.evidencias_urls, '[]'::jsonb) AS evidencias_urls,
        f_child.aprovado_por AS trade_validado_por,
        f_child.aprovado_em AS trade_validado_em
    FROM public.cm_acoes_investimento a
    JOIN tmp_campanha_map m ON a.id = m.acao_original_id
    CROSS JOIN LATERAL jsonb_array_elements(a.familias_detalhes) AS f
    LEFT JOIN public.cm_investimento_familias f_child 
      ON a.id = f_child.investimento_id 
      AND f_child.familia = COALESCE(f->>'familia_nome', f->>'familia_id')
    WHERE a.fase_atual IN (1, 2) AND (a.familias_detalhes IS NOT NULL AND jsonb_array_length(a.familias_detalhes) > 0)

    UNION ALL

    -- PARTE 2: Ações baseadas em SKU (familias_detalhes vazio)
    SELECT 
        m.novo_campanha_id AS campanha_id,
        a.rede,
        a.codigo_matriz,
        COALESCE((s->>'start_date')::date, a.data_inicio) AS data_inicio,
        COALESCE((s->>'end_date')::date, a.data_fim) AS data_fim,
        'single'::text AS date_mode,
        a.tipo_acao,
        a.tipo_acao_detalhe,
        COALESCE(p_sku.product_type, 'Outros') AS familia_produto,
        jsonb_build_array(jsonb_build_object(
            'familia_id', COALESCE(p_sku.product_type, 'Outros'),
            'familia_nome', COALESCE(p_sku.product_type, 'Outros'),
            'preco_flat', COALESCE((s->>'preco_flat')::numeric, 0),
            'preco_acao', COALESCE((s->>'preco_acao')::numeric, 0),
            'investimento', COALESCE((s->>'investimento')::numeric, 0),
            'expectativa_volume', COALESCE((s->>'expectativa_volume')::numeric, 0),
            'start_date', s->>'start_date',
            'end_date', s->>'end_date',
            'status_trade', 'PENDENTE'
        )) AS familias_detalhes,
        COALESCE((s->>'preco_flat')::numeric, 0) AS preco_flat,
        COALESCE((s->>'preco_acao')::numeric, 0) AS preco_acao,
        COALESCE((s->>'investimento')::numeric, 0) AS valor_investimento,
        COALESCE((s->>'expectativa_volume')::numeric, 0) AS expectativa_volume,
        'SKU'::text AS abrangencia,
        a.tipo_pagamento,
        jsonb_build_array(s) AS skus_detalhes,
        a.mes_referencia,
        a.fase_atual,
        a.is_planejamento,
        a.alertas_preventivos,
        'NAO_FATURADA' AS status_financeiro,
        COALESCE(a.checklist_comunicacao, false) AS checklist_comunicacao,
        COALESCE(a.checklist_logistica, false) AS checklist_logistica,
        COALESCE(a.checklist_auditoria, false) AS checklist_auditoria,
        COALESCE(a.checklist_conferencia, false) AS checklist_conferencia,
        COALESCE(a.evidencias_urls, '[]'::jsonb) AS evidencias_urls,
        a.trade_validado_por,
        a.trade_validado_em
    FROM public.cm_acoes_investimento a
    JOIN tmp_campanha_map m ON a.id = m.acao_original_id
    CROSS JOIN LATERAL jsonb_array_elements(a.skus_detalhes) AS s
    LEFT JOIN public.v_produtos_detalhes p_sku ON s->>'sku' = p_sku.codigo_integracao
    WHERE a.fase_atual IN (1, 2) AND (a.familias_detalhes IS NULL OR jsonb_array_length(a.familias_detalhes) = 0)
    RETURNING id, campanha_id, familia_produto
)
INSERT INTO tmp_acao_map (acao_original_id, familia_nome, campanha_id, nova_acao_id)
SELECT m.acao_original_id, n.familia_produto, m.novo_campanha_id, n.id
FROM tmp_campanha_map m
JOIN insercao_acoes n ON m.novo_campanha_id = n.campanha_id;

-- 6. Atualizar vínculos de email_tracking para apontar para a primeira nova ação correspondente
UPDATE public.cm_acoes_email_tracking e
SET acao_id = (
    SELECT nova_acao_id
    FROM tmp_acao_map
    WHERE acao_original_id = e.acao_id
    LIMIT 1
)
WHERE e.acao_id IN (SELECT acao_original_id FROM tmp_campanha_map);

-- 7. Backup físico das ações originais migradas para fins de segurança e rollback
DROP TABLE IF EXISTS public.cm_acoes_investimento_migradas_backup;
CREATE TABLE public.cm_acoes_investimento_migradas_backup AS 
SELECT * FROM public.cm_acoes_investimento
WHERE id IN (SELECT acao_original_id FROM tmp_campanha_map);

-- 8. Backup físico das famílias originais migradas para preservar histórico operacional
DROP TABLE IF EXISTS public.cm_investimento_familias_migradas_backup;
CREATE TABLE public.cm_investimento_familias_migradas_backup AS 
SELECT * FROM public.cm_investimento_familias
WHERE investimento_id IN (SELECT acao_original_id FROM tmp_campanha_map);

-- 9. Salvar tabela de relacionamento física de migração para rollback futuro
DROP TABLE IF EXISTS public.cm_migration_sprint3_mapping;
CREATE TABLE public.cm_migration_sprint3_mapping AS 
SELECT acao_original_id, familia_nome, campanha_id, nova_acao_id FROM tmp_acao_map;

-- 10. Remover as ações legadas da tabela ativa (e consequentemente suas famílias via CASCADE)
DELETE FROM public.cm_acoes_investimento
WHERE id IN (SELECT acao_original_id FROM tmp_campanha_map);

-- 11. Reativar as triggers de sincronização
ALTER TABLE public.cm_acoes_investimento ENABLE TRIGGER trg_sync_insert_parent_to_child;
ALTER TABLE public.cm_investimento_familias ENABLE TRIGGER trg_sync_child_to_parent_legacy;
ALTER TABLE public.cm_investimento_familias ENABLE TRIGGER trg_sync_checklists_to_parent_legacy;

COMMIT;
