-- ==============================================================================
-- MIGRATION: 20260905_fix_criar_negociacao_completa_parcelas.sql
-- OBJETIVO: Correção canônica do contrato de parcelas e resolução segura de gerente em criar_negociacao_completa_v1 (GATE 5.11 / 5.11A)
-- CONTRATO: valor_previsto (Single Source of Truth)
-- ==============================================================================

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
    v_val_acao NUMERIC(14,2);
    v_val_parc NUMERIC(14,2);
    v_val_parc_str TEXT;
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
    v_idx INTEGER := 0;
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

    -- Resolução de Gerente ID com Fallback Seguro (sem cast inválido de employee_code varchar)
    IF (p_campanha->>'gerente_id') IS NOT NULL AND TRIM(p_campanha->>'gerente_id') <> '' THEN
        IF (p_campanha->>'gerente_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
            v_gerente_id := (p_campanha->>'gerente_id')::uuid;
        END IF;
    END IF;

    IF v_gerente_id IS NULL THEN
        -- Tentar resolver por vínculo cm_clientes.manager_id -> cm_user_profiles.employee_code
        SELECT p.id INTO v_fallback_gerente_id
        FROM public.cm_clientes c
        JOIN public.cm_user_profiles p ON p.employee_code = c.manager_id
        WHERE ((v_codigo_matriz IS NOT NULL AND c.codigo_matriz = v_codigo_matriz)
           OR (c.nome_parceiro ILIKE '%' || v_rede || '%' OR c.matriz ILIKE '%' || v_rede || '%'))
          AND c.manager_id IS NOT NULL
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

        IF (v_acao->>'valor_investimento') IS NOT NULL AND TRIM(v_acao->>'valor_investimento') <> '' THEN
            IF NOT (TRIM(v_acao->>'valor_investimento') ~ '^[0-9]+(\.[0-9]+)?$') THEN
                RAISE EXCEPTION 'Inconsistência Financeira: O valor_investimento da ação possui formato numérico inválido (%).', v_acao->>'valor_investimento';
            END IF;
            v_val_acao := (v_acao->>'valor_investimento')::numeric;
            IF v_val_acao < 0 THEN
                RAISE EXCEPTION 'Inconsistência Financeira: O valor_investimento da ação não pode ser negativo.';
            END IF;
        ELSE
            v_val_acao := 0.00;
        END IF;

        v_total_acoes := v_total_acoes + v_val_acao;
        v_count_acoes := v_count_acoes + 1;
    END LOOP;

    -- [E] Cálculo e Validação Segura das Parcelas (Contrato Canônico: valor_previsto)
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
            v_val_parc_str := TRIM(COALESCE(v_parc->>'valor_previsto', ''));
            IF v_val_parc_str = '' THEN
                RAISE EXCEPTION 'Inconsistência Financeira: Todas as parcelas devem conter o campo valor_previsto preenchido.';
            END IF;

            IF NOT (v_val_parc_str ~ '^[0-9]+(\.[0-9]+)?$') THEN
                RAISE EXCEPTION 'Inconsistência Financeira: O valor_previsto da parcela (%) possui formato numérico inválido.', v_val_parc_str;
            END IF;

            v_val_parc := v_val_parc_str::numeric;
            IF v_val_parc <= 0 THEN
                RAISE EXCEPTION 'Inconsistência Financeira: O valor_previsto da parcela deve ser maior que zero (R$ %).', v_val_parc;
            END IF;

            v_total_parcelas := v_total_parcelas + v_val_parc;
            v_count_parcelas := v_count_parcelas + 1;
        END LOOP;

        IF ABS(v_total_acoes - v_total_parcelas) > 0.01 THEN
            RAISE EXCEPTION 'Inconsistência Financeira: A soma das parcelas (R$ %) diverge do valor total das ações (R$ %). Diferença: R$ %',
                v_total_parcelas, v_total_acoes, (v_total_acoes - v_total_parcelas);
        END IF;
    ELSE
        -- Fallback seguro: se não enviado array de parcelas, gerar 1 parcela à vista no valor total
        v_total_parcelas := v_total_acoes;
        v_count_parcelas := 1;
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

    -- [H] Inserção da Grade de Parcelas Financeiras (Contrato Canônico: valor_previsto)
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        v_idx := 0;
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
            v_idx := v_idx + 1;
            v_val_parc := (v_parc->>'valor_previsto')::numeric;
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
                COALESCE((v_parc->>'numero_parcela')::integer, v_idx),
                COALESCE((v_parc->>'total_parcelas')::integer, v_count_parcelas),
                v_val_parc,
                v_val_parc,
                0.00,
                v_val_parc,
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

REVOKE ALL ON FUNCTION public.criar_negociacao_completa_v1(JSONB, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_negociacao_completa_v1(JSONB, JSONB, JSONB, UUID, TEXT) TO authenticated, service_role;
