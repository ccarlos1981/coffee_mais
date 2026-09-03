-- Migration: 20260903_is_test_admin_delete.sql
-- Description: Implementação Canônica da Exclusão Administrativa de Ações de Teste (Gate 5.10A)
-- Perfis Autorizados: Trade, Admin, Admin Master, CEO
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED (Extensão Incremental e Retrocompatível)

-- 1. ADIÇÃO DA COLUNA CANÔNICA DE TESTE
ALTER TABLE public.cm_acoes_investimento 
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. CRIAÇÃO DE ÍNDICE PARCIAL PARA REGISTROS DE TESTE
CREATE INDEX IF NOT EXISTS idx_cm_acoes_is_test 
  ON public.cm_acoes_investimento(is_test) 
  WHERE is_test = TRUE;

-- 3. ATUALIZAÇÃO DA VIEW v_acoes_investimento_com_gerente
DROP VIEW IF EXISTS public.v_acoes_investimento_com_gerente CASCADE;

CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
SELECT 
    a.id,
    a.data_registro,
    a.rede,
    a.data_inicio,
    a.data_fim,
    a.tipo_acao,
    a.tipo_acao_detalhe,
    a.familia_produto,
    a.valor_investimento,
    a.created_at,
    a.updated_at,
    a.documento_url,
    a.codigo,
    a.preco_consumidor,
    a.expectativa_volume,
    a.abrangencia,
    a.skus_detalhes,
    a.tipo_pagamento,
    a.preco_flat,
    a.preco_acao,
    a.fase_atual,
    a.trade_validado_em,
    a.trade_validado_por,
    a.numero_acordo,
    a.evidencias_urls,
    a.volume_vendido_sellout,
    a.vencimento,
    a.dados_quitacao,
    a.apuracao_preenchida_em,
    a.apuracao_preenchida_por,
    a.trade_conferido_em,
    a.trade_conferido_por,
    a.trade_conferencia_aprovado,
    a.trade_conferencia_observacao,
    a.financeiro_pago_em,
    a.financeiro_pago_por,
    a.financeiro_comprovante_url,
    a.financeiro_observacoes,
    a.checklist_comunicacao,
    a.checklist_logistica,
    a.checklist_auditoria,
    a.checklist_garantia,
    a.apuracao_numero_acordo,
    a.apuracao_qtd_vendida,
    a.apuracao_valor_realizado,
    a.apuracao_evidencias_url,
    a.apuracao_boleto_id,
    a.checklist_conferencia,
    a.checklist_sem_auditoria,
    a.mes_referencia,
    a.codigo_matriz,
    a.is_planejamento,
    a.financeiro_boleto_url,
    a.sem_boleto,
    a.familias_detalhes,
    a.approved_snapshot,
    a.approved_by,
    a.approved_at,
    a.real_volume,
    a.real_faturamento,
    a.real_margem,
    a.roi,
    a.alertas_preventivos,
    a.is_reopened,
    a.reopened_by,
    a.reopened_at,
    a.reopened_reason,
    a.approval_comment,
    a.rejection_reason,
    a.cancel_reason,
    a.roi_mode,
    a.approved_alerts_snapshot,
    a.action_result,
    a.post_action_notes,
    a.execution_score,
    a.date_mode,
    a.import_batch_id,
    a.possui_divergencia_calendario,
    a.data_inicio_real,
    a.data_fim_real,
    a.motivo_divergencia_calendario,
    a.observacao_divergencia,
    a.is_test,
    COALESCE(a.condicao_pagamento, (
        SELECT cm_clientes.condicao_pagamento
        FROM cm_clientes
        WHERE cm_clientes.codigo_matriz = a.codigo_matriz
        LIMIT 1
    ), (
        SELECT cm_clientes.condicao_pagamento
        FROM cm_clientes
        WHERE upper(cm_clientes.matriz) = upper(a.rede)
        LIMIT 1
    )) AS condicao_pagamento,
    (
        SELECT up.name
        FROM cm_user_profiles up
        WHERE up.id = c.gerente_id
    ) AS gerente_responsavel,
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha,
    a.devolvido_por,
    a.devolvido_em,
    (
        (a.financeiro_pago_em IS NOT NULL) OR
        (a.campanha_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cm_investimento_parcelas p WHERE p.campanha_id = a.campanha_id
        )) OR
        (a.campanha_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cm_investimento_pagamentos pg WHERE pg.campanha_id = a.campanha_id
        )) OR
        (EXISTS (
            SELECT 1 FROM cm_acoes_boletos_vinculo vb
            JOIN cm_boletos b ON b.id = vb.boleto_id
            WHERE vb.acao_id = a.id AND b.status = ANY (ARRAY['PAGO'::text, 'BAIXADO'::text, 'QUITADO'::text])
        ))
    ) AS possui_dependencia_financeira
FROM cm_acoes_investimento a
LEFT JOIN cm_campanhas c ON a.campanha_id = c.id;

-- 4. ATUALIZAÇÃO DA RPC criar_negociacao_completa_v1 PARA SUPORTAR is_test COM RBAC SEGURO
CREATE OR REPLACE FUNCTION public.criar_negociacao_completa_v1(
    p_campanha JSONB,
    p_acoes JSONB,
    p_parcelas JSONB DEFAULT '[]'::jsonb,
    p_user_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campanha_id UUID;
    v_total_acoes NUMERIC(14,2) := 0.00;
    v_total_parcelas NUMERIC(14,2) := 0.00;
    v_acao JSONB;
    v_parc JSONB;
    v_rede TEXT;
    v_codigo_matriz TEXT;
    v_mes_referencia TEXT;
    v_gerente_id UUID;
    v_is_planejamento BOOLEAN := false;
    v_existing_audit RECORD;
    v_count_acoes INTEGER := 0;
    v_count_parcelas INTEGER := 0;
    v_fallback_gerente_id UUID;
    v_caller_role TEXT := NULL;
    v_can_create_test BOOLEAN := false;
    v_is_test_action BOOLEAN := false;
BEGIN
    -- [A] Validação de Idempotência
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('negociacao_create_' || p_idempotency_key));

        SELECT * INTO v_existing_audit
        FROM public.cm_audit_logs
        WHERE action = 'CRIAR_NEGOCIACAO_COMPLETA'
          AND (new_data->>'idempotency_key' = p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'campanha_id', v_existing_audit.new_data->>'campanha_id',
                'message', 'Negociação já criada anteriormente (idempotente).'
            );
        END IF;
    END IF;

    -- [B] Identificação e RBAC para Ações de Teste (Estrito: Trade e Admin)
    IF p_user_id IS NOT NULL THEN
        SELECT role INTO v_caller_role 
        FROM public.cm_user_profiles 
        WHERE id = p_user_id AND approved = true;
        
        IF v_caller_role IN ('Trade', 'Admin') THEN
            v_can_create_test := true;
        END IF;
    END IF;

    -- [C] Extração e Validação dos Dados da Campanha
    v_rede := TRIM(COALESCE(p_campanha->>'rede', ''));
    v_codigo_matriz := NULLIF(TRIM(COALESCE(p_campanha->>'codigo_matriz', '')), '');
    v_mes_referencia := TRIM(COALESCE(p_campanha->>'mes_referencia', ''));
    v_is_planejamento := COALESCE((p_campanha->>'is_planejamento')::boolean, false);

    IF v_rede = '' OR v_mes_referencia = '' THEN
        RAISE EXCEPTION 'Rede e Mês de Referência são obrigatórios para a negociação.';
    END IF;

    -- Resolução de Gerente ID com Fallback Seguro
    IF (p_campanha->>'gerente_id') IS NOT NULL AND TRIM(p_campanha->>'gerente_id') <> '' THEN
        v_gerente_id := (p_campanha->>'gerente_id')::uuid;
    END IF;

    IF v_gerente_id IS NULL THEN
        SELECT manager_id INTO v_fallback_gerente_id
        FROM public.cm_clientes
        WHERE (v_codigo_matriz IS NOT NULL AND codigo_matriz = v_codigo_matriz)
           OR (nome_parceiro ILIKE '%' || v_rede || '%' OR matriz ILIKE '%' || v_rede || '%')
        LIMIT 1;

        v_gerente_id := COALESCE(v_fallback_gerente_id, p_user_id);
    END IF;

    IF v_gerente_id IS NULL THEN
        SELECT id INTO v_gerente_id
        FROM public.cm_user_profiles
        WHERE approved = true AND role IN ('Admin', 'Admin Master', 'Gerente Regional')
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- [D] Cálculo e Validação da Soma das Ações
    IF p_acoes IS NULL OR jsonb_array_length(p_acoes) = 0 THEN
        RAISE EXCEPTION 'Ao menos uma ação comercial deve ser informada.';
    END IF;

    FOR v_acao IN SELECT * FROM jsonb_array_elements(p_acoes) LOOP
        IF TRIM(COALESCE(v_acao->>'rede', '')) <> v_rede THEN
            RAISE EXCEPTION 'Violação de Integridade: Todas as ações devem pertencer à mesma rede (%).', v_rede;
        END IF;
        v_total_acoes := v_total_acoes + COALESCE((v_acao->>'valor_investimento')::numeric, 0.00);
        v_count_acoes := v_count_acoes + 1;
    END LOOP;

    -- [E] Cálculo e Validação da Soma das Parcelas
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
            v_total_parcelas := v_total_parcelas + COALESCE((v_parc->>'valor_previsto')::numeric, 0.00);
            v_count_parcelas := v_count_parcelas + 1;
        END LOOP;

        IF ABS(v_total_acoes - v_total_parcelas) > 0.01 THEN
            RAISE EXCEPTION 'INCONSISTENCIA_FINANCEIRA: Soma das parcelas (R$ %) diverge do total das ações comerciais (R$ %). Diferença: R$ %',
                v_total_parcelas, v_total_acoes, (v_total_acoes - v_total_parcelas);
        END IF;
    ELSE
        v_total_parcelas := v_total_acoes;
    END IF;

    -- [F] Inserção da Campanha Master
    INSERT INTO public.cm_campanhas (
        nome_campanha,
        rede,
        codigo_matriz,
        mes_referencia,
        status_operacional,
        status_financeiro,
        gerente_id,
        valor_total_projetado,
        saldo_financeiro_devedor,
        tipo_plano_financeiro
    ) VALUES (
        COALESCE(p_campanha->>'nome_campanha', 'Campanha ' || v_rede || ' - ' || v_mes_referencia),
        v_rede,
        v_codigo_matriz,
        v_mes_referencia,
        COALESCE(p_campanha->>'status_operacional', 'PLANEJAMENTO'),
        'ABERTA',
        v_gerente_id,
        v_total_acoes,
        v_total_acoes,
        COALESCE(p_campanha->>'tipo_plano_financeiro', CASE WHEN v_count_parcelas > 1 THEN 'PARCELADO' ELSE 'A_VISTA' END)
    ) RETURNING id INTO v_campanha_id;

    -- [G] Inserção das Ações Comerciais (com validação estrita de is_test)
    FOR v_acao IN SELECT * FROM jsonb_array_elements(p_acoes) LOOP
        -- Apenas Trade/Admin pode persistir is_test = TRUE
        IF v_can_create_test AND COALESCE((v_acao->>'is_test')::boolean, (p_campanha->>'is_test')::boolean, false) = true THEN
            v_is_test_action := true;
        ELSE
            v_is_test_action := false;
        END IF;

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
            acao_origem_recorrencia_id,
            is_materializada_futura,
            is_test
        ) VALUES (
            v_campanha_id,
            v_rede,
            v_codigo_matriz,
            COALESCE((v_acao->>'data_inicio')::date, CURRENT_DATE),
            COALESCE((v_acao->>'data_fim')::date, CURRENT_DATE + INTERVAL '30 days'),
            COALESCE(v_acao->>'date_mode', 'single'),
            COALESCE(v_acao->>'tipo_acao', 'Vendas'),
            COALESCE(v_acao->>'tipo_acao_detalhe', 'Ação de Vendas'),
            COALESCE(v_acao->>'familia_produto', 'Clássico'),
            COALESCE(v_acao->'familias_detalhes', '[]'::jsonb),
            COALESCE((v_acao->>'preco_flat')::numeric, 0),
            COALESCE((v_acao->>'preco_acao')::numeric, 0),
            COALESCE((v_acao->>'valor_investimento')::numeric, 0),
            COALESCE((v_acao->>'expectativa_volume')::numeric, 0),
            COALESCE(v_acao->>'abrangencia', 'Família'),
            COALESCE(v_acao->>'tipo_pagamento', 'Transf. Bancária'),
            COALESCE(v_acao->'skus_detalhes', '[]'::jsonb),
            COALESCE(v_acao->>'mes_referencia', v_mes_referencia),
            COALESCE((v_acao->>'fase_atual')::integer, 1),
            v_is_planejamento,
            COALESCE(v_acao->'alertas_preventivos', '[]'::jsonb),
            'NAO_FATURADA',
            (v_acao->>'acao_origem_recorrencia_id')::uuid,
            COALESCE((v_acao->>'is_materializada_futura')::boolean, false),
            v_is_test_action
        );
    END LOOP;

    -- [H] Inserção da Grade de Parcelas Financeiras
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
            INSERT INTO public.cm_investimento_parcelas (
                campanha_id,
                numero_parcela,
                total_parcelas,
                valor_previsto_original,
                valor_previsto,
                valor_pago_acumulado,
                saldo_remanescente,
                data_vencimento,
                status_parcela,
                tipo_pagamento,
                is_planejamento,
                observacoes
            ) VALUES (
                v_campanha_id,
                (v_parc->>'numero_parcela')::integer,
                COALESCE((v_parc->>'total_parcelas')::integer, v_count_parcelas),
                (v_parc->>'valor_previsto')::numeric,
                (v_parc->>'valor_previsto')::numeric,
                0.00,
                (v_parc->>'valor_previsto')::numeric,
                COALESCE((v_parc->>'data_vencimento')::date, CURRENT_DATE),
                'PENDENTE',
                COALESCE(v_parc->>'tipo_pagamento', 'Transf. Bancária'),
                v_is_planejamento,
                v_parc->>'observacoes'
            );
        END LOOP;
    ELSE
        INSERT INTO public.cm_investimento_parcelas (
            campanha_id,
            numero_parcela,
            total_parcelas,
            valor_previsto_original,
            valor_previsto,
            valor_pago_acumulado,
            saldo_remanescente,
            data_vencimento,
            status_parcela,
            tipo_pagamento,
            is_planejamento
        ) VALUES (
            v_campanha_id,
            1,
            1,
            v_total_acoes,
            v_total_acoes,
            0.00,
            v_total_acoes,
            COALESCE((SELECT MIN((elem->>'data_inicio')::date) FROM jsonb_array_elements(p_acoes) elem), CURRENT_DATE),
            'PENDENTE',
            'Transf. Bancária',
            v_is_planejamento
        );
    END IF;

    -- [I] Registro em Audit Log
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_campanhas',
        'CRIAR_NEGOCIACAO_COMPLETA',
        p_user_id,
        jsonb_build_object(
            'campanha_id', v_campanha_id,
            'rede', v_rede,
            'codigo_matriz', v_codigo_matriz,
            'mes_referencia', v_mes_referencia,
            'valor_total_projetado', v_total_acoes,
            'total_acoes', v_count_acoes,
            'total_parcelas', v_count_parcelas,
            'is_planejamento', v_is_planejamento,
            'is_test', v_is_test_action,
            'idempotency_key', p_idempotency_key,
            'criado_por', p_user_id,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'campanha_id', v_campanha_id,
        'total_acoes', v_count_acoes,
        'total_parcelas', v_count_parcelas,
        'valor_total', v_total_acoes
    );
END;
$$;

-- 5. CRIAÇÃO DA RPC SOBERANA excluir_acao_investimento_teste_v1
CREATE OR REPLACE FUNCTION public.excluir_acao_investimento_teste_v1(
    p_acao_id UUID,
    p_motivo TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_auth_uid UUID;
    v_auth_role TEXT;
    v_effective_user_id UUID;
    v_user_profile RECORD;
    v_acao RECORD;
    v_fase INTEGER;
BEGIN
    -- [A] Identificação Canônica do Usuário
    v_auth_uid := auth.uid();
    v_auth_role := auth.role();

    IF v_auth_role = 'authenticated' OR v_auth_uid IS NOT NULL THEN
        IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: Identidade p_user_id divergente do token autenticado auth.uid().';
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSIF v_auth_role = 'service_role' OR (v_auth_uid IS NULL AND current_user = 'postgres') THEN
        v_effective_user_id := p_user_id;
    ELSE
        v_effective_user_id := COALESCE(v_auth_uid, p_user_id);
    END IF;

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Identidade do usuário não informada.';
    END IF;

    -- [B] Validação do Perfil e Role (RBAC: Apenas Trade e Admin)
    SELECT * INTO v_user_profile 
    FROM public.cm_user_profiles 
    WHERE id = v_effective_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil do usuário % não encontrado em cm_user_profiles.', v_effective_user_id;
    END IF;

    IF COALESCE(v_user_profile.approved, false) = false THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil % não está aprovado.', v_effective_user_id;
    END IF;

    IF v_user_profile.role NOT IN ('Trade', 'Admin') THEN
        RAISE EXCEPTION 'Acesso Negado: Apenas os perfis Trade e Admin possuem autorização para exclusão administrativa de testes (role atual: "%").', v_user_profile.role;
    END IF;

    -- [C] Carregamento da Ação com Lock Transacional FOR UPDATE (Prevenção de Concorrência e Race Condition)
    SELECT * INTO v_acao 
    FROM public.cm_acoes_investimento 
    WHERE id = p_acao_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'error', 'Ação não encontrada ou já excluída.'
        );
    END IF;

    -- [D] Condição Fundamental: Ação DEVE estar explicitamente classificada como is_test = TRUE
    IF COALESCE(v_acao.is_test, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Operação Bloqueada: esta ação não está classificada como ação de teste.';
    END IF;

    -- [E] Validação de Fases Permitidas (Fase 1 a 4). Fase 5 e 6 bloqueadas para preservação histórica/fechamento.
    v_fase := COALESCE(v_acao.fase_atual, 1);
    IF v_fase > 4 THEN
        RAISE EXCEPTION 'Operação Bloqueada: Ações em Fase % possuem fechamento financeiro/histórico e não podem ser excluídas.', v_fase;
    END IF;

    -- [F] Bloqueio Financeiro Absoluto (Nenhuma dependência financeira permitida)
    -- 1. Qualquer parcela vinculada à campanha
    IF v_acao.campanha_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.cm_investimento_parcelas 
        WHERE campanha_id = v_acao.campanha_id
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada: Esta ação possui plano financeiro de parcelas vinculado à negociação.';
    END IF;

    -- 2. Qualquer pagamento registrado na campanha
    IF v_acao.campanha_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.cm_investimento_pagamentos 
        WHERE campanha_id = v_acao.campanha_id
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada: Esta ação possui pagamentos registrados vinculados à negociação.';
    END IF;

    -- 3. Ação com confirmação de pagamento financeiro
    IF v_acao.financeiro_pago_em IS NOT NULL THEN
        RAISE EXCEPTION 'Operação Bloqueada: Ação com pagamento confirmado no Financeiro não pode ser excluída.';
    END IF;

    -- 4. Vínculo com boleto já quitado, pago ou baixado
    IF EXISTS (
        SELECT 1 FROM public.cm_acoes_boletos_vinculo vb
        JOIN public.cm_boletos b ON b.id = vb.boleto_id
        WHERE vb.acao_id = p_acao_id AND b.status IN ('PAGO', 'BAIXADO', 'QUITADO')
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada: Esta ação possui vínculo com boleto já quitado/baixado.';
    END IF;

    -- [G] Registro Atômico de Auditoria Forense com Ação ADMIN_TEST_DELETE e Snapshot Completo
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        old_data,
        new_data
    ) VALUES (
        'cm_acoes_investimento',
        'ADMIN_TEST_DELETE',
        v_effective_user_id,
        jsonb_build_object(
            'id', v_acao.id,
            'codigo', v_acao.codigo,
            'rede', v_acao.rede,
            'codigo_matriz', v_acao.codigo_matriz,
            'campanha_id', v_acao.campanha_id,
            'fase_atual', v_acao.fase_atual,
            'is_planejamento', v_acao.is_planejamento,
            'is_test', v_acao.is_test,
            'valor_investimento', v_acao.valor_investimento,
            'expectativa_volume', v_acao.expectativa_volume,
            'mes_referencia', v_acao.mes_referencia,
            'data_inicio', v_acao.data_inicio,
            'data_fim', v_acao.data_fim,
            'tipo_acao', v_acao.tipo_acao,
            'tipo_acao_detalhe', v_acao.tipo_acao_detalhe,
            'familia_produto', v_acao.familia_produto,
            'familias_detalhes', v_acao.familias_detalhes,
            'skus_detalhes', v_acao.skus_detalhes,
            'motivo_exclusao', COALESCE(p_motivo, 'Exclusão administrativa de ação de teste'),
            'deleted_by_role', v_user_profile.role,
            'deleted_by_name', v_user_profile.name,
            'deleted_by_id', v_effective_user_id,
            'deleted_at', now()
        ),
        NULL
    );

    -- [H] Remoção em Cascata Segura de Vínculos Auxiliares
    DELETE FROM public.cm_acoes_boletos_vinculo WHERE acao_id = p_acao_id;
    DELETE FROM public.cm_acoes_email_tracking WHERE acao_id = p_acao_id;
    DELETE FROM public.cm_investimento_familias WHERE investimento_id = p_acao_id;
    UPDATE public.cm_acoes_investimento SET acao_origem_recorrencia_id = NULL WHERE acao_origem_recorrencia_id = p_acao_id;

    -- [I] Exclusão Física Definitiva da Ação de Teste
    DELETE FROM public.cm_acoes_investimento WHERE id = p_acao_id;

    -- [J] Recálculo Agregado da Campanha Pai (cm_campanhas NUNCA é excluída automaticamente)
    IF v_acao.campanha_id IS NOT NULL THEN
        UPDATE public.cm_campanhas 
        SET 
            valor_total_projetado = (
                SELECT COALESCE(SUM(valor_investimento), 0.00) 
                FROM public.cm_acoes_investimento 
                WHERE campanha_id = v_acao.campanha_id
            ),
            saldo_financeiro_devedor = (
                SELECT COALESCE(SUM(valor_investimento), 0.00) 
                FROM public.cm_acoes_investimento 
                WHERE campanha_id = v_acao.campanha_id
            ),
            updated_at = now()
        WHERE id = v_acao.campanha_id;
    END IF;

    -- [K] Retorno Transacional Estruturado
    RETURN jsonb_build_object(
        'success', true,
        'acao_id', p_acao_id,
        'campanha_id', v_acao.campanha_id,
        'deleted_rows', 1,
        'message', 'Ação de teste excluída com sucesso via operação administrativa.'
    );
END;
$$;

-- 6. AJUSTE DE PRIVILÉGIOS E GRANTS DA RPC
REVOKE ALL ON FUNCTION public.excluir_acao_investimento_teste_v1(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_acao_investimento_teste_v1(UUID, TEXT, UUID) TO authenticated, service_role;
