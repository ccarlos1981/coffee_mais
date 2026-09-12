-- ==============================================================================
-- MIGRATION: 20260911_gate_5_17_fase2_definir_plano_financeiro.sql
-- RDM GATE 5.17 - FASE 2: Backend / Persistência do Fechamento Financeiro
-- Operação Canônica: Definir Plano Financeiro no Nível da CAMPANHA (Fase 3)
-- Atomicidade: Transação única (Campanha + Parcelas + Boletos + Saldo + Auditoria)
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.definir_plano_financeiro_campanha_v1(
    p_campanha_id UUID,
    p_tipo_plano TEXT,
    p_parcelas JSONB,
    p_boletos JSONB DEFAULT '[]'::jsonb,
    p_user_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campanha RECORD;
    v_total_acoes_count INTEGER := 0;
    v_total_campanha NUMERIC(14,2) := 0.00;
    v_acoes_nao_prontas INTEGER := 0;
    v_total_parcelas NUMERIC(14,2) := 0.00;
    v_count_parcelas INTEGER := 0;
    v_parc JSONB;
    v_val_parc NUMERIC(14,2);
    v_val_parc_str TEXT;
    v_vencimento_str TEXT;
    v_vencimento_date DATE;
    v_tipo_pagamento TEXT;
    v_observacoes TEXT;
    v_tipo_plano TEXT;
    v_existing_audit RECORD;
    v_caller_role TEXT;
    v_pagamentos_count INTEGER := 0;
    v_parcelas_pagas_count INTEGER := 0;
    v_idx INTEGER := 0;
    v_bol JSONB;
    v_boleto_id UUID;
    v_boleto_acao_id UUID;
    v_first_acao_id UUID;
    v_valor_associado NUMERIC(14,2);
    v_boletos_vinculados_count INTEGER := 0;
BEGIN
    -- [1] Idempotência e Serialização Concorrente
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('camp_fin_plan_' || p_idempotency_key));

        SELECT * INTO v_existing_audit
        FROM public.cm_audit_logs
        WHERE action = 'DEFINIR_PLANO_FINANCEIRO_CAMPANHA'
          AND (new_data->>'idempotency_key' = p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'campanha_id', v_existing_audit.new_data->>'campanha_id',
                'tipo_plano', v_existing_audit.new_data->>'tipo_plano',
                'valor_total', (v_existing_audit.new_data->>'valor_total')::numeric,
                'total_parcelas', (v_existing_audit.new_data->>'quantidade_parcelas')::integer,
                'message', 'Plano financeiro da campanha já definido anteriormente (idempotente).'
            );
        END IF;
    END IF;

    -- Trava transacional exclusiva na campanha para concorrência
    PERFORM pg_advisory_xact_lock(hashtext('camp_fin_lock_' || p_campanha_id::text));

    -- [2] Validação RBAC
    IF p_user_id IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.cm_user_profiles
        WHERE id = p_user_id AND approved = true;

        IF v_caller_role IS NULL OR v_caller_role NOT IN ('Admin', 'Admin Master', 'Gerente Regional', 'Trade', 'Financeiro', 'Diretor', 'CEO') THEN
            RAISE EXCEPTION 'Acesso negado: Usuário (%) com perfil (%) não autorizado a definir plano financeiro.', p_user_id, COALESCE(v_caller_role, 'N/A');
        END IF;
    END IF;

    -- [3] Busca e Bloqueio da Campanha
    SELECT * INTO v_campanha
    FROM public.cm_campanhas
    WHERE id = p_campanha_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campanha % não encontrada.', p_campanha_id;
    END IF;

    -- Se já tiver plano financeiro (não PENDENTE), verificar se há pagamentos já amortizados
    IF v_campanha.tipo_plano_financeiro IN ('A_VISTA', 'PARCELADO') THEN
        SELECT COUNT(*) INTO v_pagamentos_count
        FROM public.cm_investimento_pagamentos
        WHERE campanha_id = p_campanha_id;

        SELECT COUNT(*) INTO v_parcelas_pagas_count
        FROM public.cm_investimento_parcelas
        WHERE campanha_id = p_campanha_id AND status_parcela != 'PENDENTE';

        IF v_pagamentos_count > 0 OR v_parcelas_pagas_count > 0 THEN
            RAISE EXCEPTION 'Operação Bloqueada: Campanha já possui histórico financeiro amortizado/liquidado. Não é permitido redefinir plano financeiro.';
        END IF;
    END IF;

    -- [4] Validação de Multi-Ações e Prontidão (Readiness)
    SELECT COUNT(*), COALESCE(SUM(valor_investimento), 0.00)
    INTO v_total_acoes_count, v_total_campanha
    FROM public.cm_acoes_investimento
    WHERE campanha_id = p_campanha_id AND cancel_reason IS NULL;

    IF v_total_acoes_count = 0 THEN
        RAISE EXCEPTION 'Campanha % não possui ações ativas elegíveis para fechamento financeiro.', p_campanha_id;
    END IF;

    SELECT id INTO v_first_acao_id
    FROM public.cm_acoes_investimento
    WHERE campanha_id = p_campanha_id AND cancel_reason IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Verificar se existem ações ativas em fases anteriores a 3
    SELECT COUNT(*) INTO v_acoes_nao_prontas
    FROM public.cm_acoes_investimento
    WHERE campanha_id = p_campanha_id AND cancel_reason IS NULL AND fase_atual < 3;

    IF v_acoes_nao_prontas > 0 THEN
        RAISE EXCEPTION 'Campanha não está apta ao fechamento financeiro. Existem % ação(ões) ativas que ainda não atingiram a Fase 3 (Apuração).', v_acoes_nao_prontas;
    END IF;

    -- [5] Validação do Tipo de Plano
    v_tipo_plano := UPPER(TRIM(COALESCE(p_tipo_plano, '')));
    IF v_tipo_plano NOT IN ('A_VISTA', 'PARCELADO') THEN
        RAISE EXCEPTION 'Tipo de plano financeiro inválido: (%). Deve ser A_VISTA ou PARCELADO.', p_tipo_plano;
    END IF;

    IF p_parcelas IS NULL OR jsonb_typeof(p_parcelas) <> 'array' OR jsonb_array_length(p_parcelas) = 0 THEN
        RAISE EXCEPTION 'Ao menos uma parcela deve ser informada no plano financeiro.';
    END IF;

    IF v_tipo_plano = 'A_VISTA' AND jsonb_array_length(p_parcelas) <> 1 THEN
        RAISE EXCEPTION 'Plano A_VISTA deve conter exatamente 1 parcela. Recebido: %.', jsonb_array_length(p_parcelas);
    END IF;

    -- [6] Validação Aritmética e Estrutural das Parcelas
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

    -- Validação de Paridade com tolerância monetária oficial de R$ 0,01
    IF ABS(v_total_campanha - v_total_parcelas) > 0.01 THEN
        RAISE EXCEPTION 'Inconsistência Financeira: A soma das parcelas (R$ %) diverge do valor total consolidado da campanha (R$ %). Diferença: R$ %',
            v_total_parcelas, v_total_campanha, (v_total_campanha - v_total_parcelas);
    END IF;

    -- [7] Validação e Vínculo de Boletos
    IF p_boletos IS NOT NULL AND jsonb_typeof(p_boletos) = 'array' AND jsonb_array_length(p_boletos) > 0 THEN
        FOR v_bol IN SELECT * FROM jsonb_array_elements(p_boletos) LOOP
            IF (v_bol->>'boleto_id') IS NOT NULL AND TRIM(v_bol->>'boleto_id') <> '' THEN
                v_boleto_id := (v_bol->>'boleto_id')::uuid;

                -- Validar se boleto existe no sistema
                IF NOT EXISTS (SELECT 1 FROM public.cm_boletos WHERE id = v_boleto_id) THEN
                    RAISE EXCEPTION 'Boleto ID % informado não existe no sistema.', v_boleto_id;
                END IF;

                -- Definir ação de destino para o vínculo
                IF (v_bol->>'acao_id') IS NOT NULL AND TRIM(v_bol->>'acao_id') <> '' THEN
                    v_boleto_acao_id := (v_bol->>'acao_id')::uuid;
                    -- Validar que a ação pertence a esta campanha
                    IF NOT EXISTS (SELECT 1 FROM public.cm_acoes_investimento WHERE id = v_boleto_acao_id AND campanha_id = p_campanha_id) THEN
                        RAISE EXCEPTION 'Ação ID % do boleto não pertence à campanha %.', v_boleto_acao_id, p_campanha_id;
                    END IF;
                ELSE
                    v_boleto_acao_id := v_first_acao_id;
                END IF;

                v_valor_associado := COALESCE((v_bol->>'valor_associado')::numeric, v_total_campanha);

                -- Inserir vínculo se ainda não existir
                IF NOT EXISTS (SELECT 1 FROM public.cm_acoes_boletos_vinculo WHERE acao_id = v_boleto_acao_id AND boleto_id = v_boleto_id) THEN
                    INSERT INTO public.cm_acoes_boletos_vinculo (
                        acao_id,
                        boleto_id,
                        valor_associado
                    ) VALUES (
                        v_boleto_acao_id,
                        v_boleto_id,
                        v_valor_associado
                    );
                    v_boletos_vinculados_count := v_boletos_vinculados_count + 1;
                END IF;

                -- Atualizar apuracao_boleto_id na ação se ainda for NULL
                UPDATE public.cm_acoes_investimento
                SET apuracao_boleto_id = COALESCE(apuracao_boleto_id, v_boleto_id)
                WHERE id = v_boleto_acao_id;
            END IF;
        END LOOP;
    END IF;

    -- [8] Persistência Atômica das Parcelas
    -- Limpar parcelas pendentes anteriores da campanha caso seja redefinição sem pagamentos
    DELETE FROM public.cm_investimento_parcelas
    WHERE campanha_id = p_campanha_id AND status_parcela = 'PENDENTE';

    v_idx := 0;
    FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
        v_idx := v_idx + 1;
        v_val_parc := (v_parc->>'valor_previsto')::numeric;
        v_vencimento_str := TRIM(COALESCE(v_parc->>'data_vencimento', ''));
        IF v_vencimento_str <> '' THEN
            v_vencimento_date := v_vencimento_str::date;
        ELSE
            v_vencimento_date := CURRENT_DATE;
        END IF;
        v_tipo_pagamento := COALESCE(NULLIF(TRIM(v_parc->>'tipo_pagamento'), ''), 'Transf. Bancária');
        v_observacoes := NULLIF(TRIM(v_parc->>'observacoes'), '');

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
            p_campanha_id,
            COALESCE((v_parc->>'numero_parcela')::integer, v_idx),
            v_count_parcelas,
            v_val_parc,
            v_val_parc,
            0.00,
            v_val_parc,
            v_vencimento_date,
            'PENDENTE',
            v_tipo_pagamento,
            false,
            v_observacoes
        );
    END LOOP;

    -- [9] Atualização Atômica da Campanha
    UPDATE public.cm_campanhas
    SET
        tipo_plano_financeiro = v_tipo_plano,
        saldo_financeiro_devedor = v_total_campanha,
        valor_total_projetado = v_total_campanha,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_campanha_id;

    -- [10] Registro de Auditoria Forense
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_campanhas',
        'DEFINIR_PLANO_FINANCEIRO_CAMPANHA',
        p_user_id,
        jsonb_build_object(
            'campanha_id', p_campanha_id,
            'tipo_plano', v_tipo_plano,
            'valor_total', v_total_campanha,
            'quantidade_parcelas', v_count_parcelas,
            'boletos_vinculados', v_boletos_vinculados_count,
            'idempotency_key', p_idempotency_key,
            'timestamp', timezone('utc'::text, now())
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'campanha_id', p_campanha_id,
        'tipo_plano', v_tipo_plano,
        'valor_total', v_total_campanha,
        'total_parcelas', v_count_parcelas,
        'saldo_financeiro_devedor', v_total_campanha,
        'boletos_vinculados', v_boletos_vinculados_count
    );
END;
$$;

-- Permissões e Segurança
REVOKE ALL ON FUNCTION public.definir_plano_financeiro_campanha_v1(UUID, TEXT, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_plano_financeiro_campanha_v1(UUID, TEXT, JSONB, JSONB, UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.definir_plano_financeiro_campanha_v1(UUID, TEXT, JSONB, JSONB, UUID, TEXT) IS
'RDM Gate 5.17 Fase 2: Define o plano financeiro da campanha de forma atômica na Fase 3. Cria parcelas, atualiza saldo devedor, valida boletos, garante idempotência e audita.';

COMMIT;
