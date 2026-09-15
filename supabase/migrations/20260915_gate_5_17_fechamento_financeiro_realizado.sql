-- ==============================================================================
-- MIGRATION: 20260915_gate_5_17_fechamento_financeiro_realizado.sql
-- RDM GATE 5.17 - FASE 2: FECHAMENTO FINANCEIRO POR AÇÃO & PARIDADE CAMINHO B
-- Nova migration complementar (preservando histórico e migrations anteriores)
--
-- Motivo: Garantir que no Caminho B (fechamento com Plano Financeiro da Campanha),
-- o valor da campanha e das parcelas reflita estritamente a soma dos valores
-- REALIZADOS (apuracao_valor_realizado) das ações ativas elegíveis, exigindo
-- que todas as ações ativas tenham apuração financeira concluída (sem COALESCE cego).
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.concluir_fechamento_investimento_completo_v1(
    p_acao_id UUID,
    p_apuracao_numero_acordo TEXT,
    p_apuracao_qtd_vendida INTEGER DEFAULT NULL,
    p_apuracao_valor_realizado NUMERIC DEFAULT NULL,
    p_apuracao_evidencias_url TEXT DEFAULT NULL,
    p_condicao_pagamento TEXT DEFAULT NULL,
    p_sem_boleto BOOLEAN DEFAULT FALSE,
    p_post_action_notes TEXT DEFAULT NULL,
    p_vinculos JSONB DEFAULT '[]'::jsonb,
    p_plano_financeiro JSONB DEFAULT NULL,
    p_user_email TEXT DEFAULT 'unknown',
    p_user_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    -- Identidade e RBAC
    v_auth_uid UUID;
    v_effective_user_id UUID;
    v_caller_role TEXT;

    -- Entidades
    v_acao public.cm_acoes_investimento%ROWTYPE;
    v_campanha public.cm_campanhas%ROWTYPE;
    v_existing_audit RECORD;

    -- Boletos (Apuração Comercial)
    v_item JSONB;
    v_boleto_id UUID;
    v_valor_associado NUMERIC(14,2);
    v_primeiro_boleto_id UUID := NULL;
    v_total_vinculos INTEGER := 0;

    -- Multi-Action e Financeiro
    v_is_caminho_b BOOLEAN := FALSE;
    v_acoes_nao_prontas INTEGER := 0;
    v_acoes_sem_apuracao INTEGER := 0;
    v_total_acoes_count INTEGER := 0;
    v_total_campanha NUMERIC(14,2) := 0.00;
    v_total_projetado_campanha NUMERIC(14,2) := 0.00;
    v_pagamentos_count INTEGER := 0;
    v_parcelas_pagas_count INTEGER := 0;

    -- Plano Financeiro e Parcelas
    v_tipo_plano TEXT;
    v_parcelas JSONB;
    v_parc JSONB;
    v_val_parc NUMERIC(14,2);
    v_val_parc_str TEXT;
    v_vencimento_str TEXT;
    v_vencimento_date DATE;
    v_tipo_pagamento TEXT;
    v_observacoes TEXT;
    v_total_parcelas NUMERIC(14,2) := 0.00;
    v_count_parcelas INTEGER := 0;
    v_idx INTEGER := 0;
BEGIN
    -- [1] Validação de Identidade e RBAC (Security Checklist)
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NOT NULL THEN
        -- Proteção Anti-Spoof: se p_user_id fornecido, deve coincidir com o token autenticado
        IF p_user_id IS NOT NULL AND p_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: Identidade p_user_id divergente do token autenticado auth.uid().';
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSE
        v_effective_user_id := p_user_id;
    END IF;

    -- Validação de perfil autorizado em cm_user_profiles
    IF v_effective_user_id IS NOT NULL THEN
        SELECT role INTO v_caller_role
        FROM public.cm_user_profiles
        WHERE id = v_effective_user_id AND approved = true;

        IF v_caller_role IS NULL OR v_caller_role NOT IN ('Admin', 'Admin Master', 'Gerente Regional', 'Gerente Nacional', 'Trade', 'Financeiro', 'Diretor', 'CEO', 'Supervisor') THEN
            RAISE EXCEPTION 'Acesso negado: Usuário (%) com perfil (%) não autorizado a realizar o fechamento.', v_effective_user_id, COALESCE(v_caller_role, 'N/A');
        END IF;
    END IF;

    -- [2] Advisory Lock de Idempotência
    IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('fechamento_idem_' || p_idempotency_key));

        -- [5] Verificação de Idempotência
        SELECT * INTO v_existing_audit
        FROM public.cm_audit_logs
        WHERE action = 'CONCLUIR_FECHAMENTO_INVESTIMENTO'
          AND (new_data->>'idempotency_key' = p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'action_id', p_acao_id,
                'campanha_id', v_existing_audit.new_data->>'campanha_id',
                'fase_atual', (v_existing_audit.new_data->>'fase_atual')::integer,
                'caminho', v_existing_audit.new_data->>'caminho',
                'tipo_plano', v_existing_audit.new_data->>'tipo_plano',
                'valor_total', (v_existing_audit.new_data->>'valor_total')::numeric,
                'total_parcelas', (v_existing_audit.new_data->>'quantidade_parcelas')::integer,
                'total_boletos_vinculados', (v_existing_audit.new_data->>'total_boletos_vinculados')::integer,
                'primeiro_boleto_id', v_existing_audit.new_data->>'primeiro_boleto_id',
                'saldo_financeiro_devedor', (v_existing_audit.new_data->>'saldo_financeiro_devedor')::numeric,
                'message', 'Operação de fechamento de investimento já concluída anteriormente (resposta idempotente).'
            );
        END IF;
    END IF;

    -- [3] Lock da Ação (SELECT FOR UPDATE)
    SELECT * INTO v_acao
    FROM public.cm_acoes_investimento
    WHERE id = p_acao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ação de investimento % não encontrada.', p_acao_id;
    END IF;

    -- Validação de cancelamento (SSOT: cancel_reason IS NULL)
    IF v_acao.cancel_reason IS NOT NULL THEN
        RAISE EXCEPTION 'Ação % cancelada/inativa. Não é permitido realizar fechamento.', p_acao_id;
    END IF;

    -- [4] Lock da Campanha (Advisory Lock + SELECT FOR UPDATE)
    PERFORM pg_advisory_xact_lock(hashtext('camp_fechamento_lock_' || v_acao.campanha_id::text));

    SELECT * INTO v_campanha
    FROM public.cm_campanhas
    WHERE id = v_acao.campanha_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Campanha % associada à ação não encontrada.', v_acao.campanha_id;
    END IF;

    -- [6] Validação da Apuração
    IF p_apuracao_numero_acordo IS NULL OR TRIM(p_apuracao_numero_acordo) = '' THEN
        RAISE EXCEPTION 'Dados do Acordo é obrigatório.';
    END IF;

    -- Validação de fase da ação
    IF v_acao.fase_atual = 4 THEN
        -- Idempotência / reenvio de ação já apurada
        NULL;
    ELSIF v_acao.fase_atual <> 3 THEN
        RAISE EXCEPTION 'Ação % não está na fase de Apuração (Fase 3). Fase atual: %', p_acao_id, v_acao.fase_atual;
    END IF;

    -- [7] Validação dos Boletos (Ownership: Apuração Comercial)
    IF p_sem_boleto IS TRUE THEN
        v_primeiro_boleto_id := NULL;
        v_total_vinculos := 0;
    ELSIF p_vinculos IS NOT NULL AND jsonb_typeof(p_vinculos) = 'array' AND jsonb_array_length(p_vinculos) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_vinculos) LOOP
            v_boleto_id := (v_item->>'boleto_id')::uuid;
            v_valor_associado := COALESCE((v_item->>'valor_associado')::numeric, 0.00);

            IF v_boleto_id IS NOT NULL THEN
                -- Verificar se o boleto existe no cadastro
                IF NOT EXISTS (SELECT 1 FROM public.cm_boletos WHERE id = v_boleto_id) THEN
                    RAISE EXCEPTION 'Boleto ID % informado não existe no sistema.', v_boleto_id;
                END IF;

                IF v_primeiro_boleto_id IS NULL THEN
                    v_primeiro_boleto_id := v_boleto_id;
                END IF;
                v_total_vinculos := v_total_vinculos + 1;
            END IF;
        END LOOP;
    END IF;

    -- [8] Gravação da Apuração e [9] Atualização da Fase da Ação
    UPDATE public.cm_acoes_investimento
    SET
        fase_atual = 4,
        devolvido_por = NULL,
        devolvido_em = NULL,
        rejection_reason = NULL,
        apuracao_numero_acordo = TRIM(p_apuracao_numero_acordo),
        apuracao_qtd_vendida = p_apuracao_qtd_vendida,
        apuracao_valor_realizado = p_apuracao_valor_realizado,
        apuracao_boleto_id = v_primeiro_boleto_id,
        apuracao_evidencias_url = p_apuracao_evidencias_url,
        condicao_pagamento = p_condicao_pagamento,
        sem_boleto = COALESCE(p_sem_boleto, FALSE),
        post_action_notes = p_post_action_notes,
        apuracao_preenchida_em = NOW(),
        apuracao_preenchida_por = COALESCE(p_user_email, 'unknown'),
        updated_at = NOW()
    WHERE id = p_acao_id;

    -- Limpar vínculos de boletos anteriores desta ação (ownership exclusivo da Apuração)
    DELETE FROM public.cm_acoes_boletos_vinculo
    WHERE acao_id = p_acao_id;

    -- Inserir novos vínculos de boletos
    IF p_sem_boleto IS NOT TRUE AND p_vinculos IS NOT NULL AND jsonb_typeof(p_vinculos) = 'array' AND jsonb_array_length(p_vinculos) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_vinculos) LOOP
            v_boleto_id := (v_item->>'boleto_id')::uuid;
            v_valor_associado := COALESCE((v_item->>'valor_associado')::numeric, 0.00);

            IF v_boleto_id IS NOT NULL THEN
                INSERT INTO public.cm_acoes_boletos_vinculo (
                    acao_id,
                    boleto_id,
                    valor_associado
                ) VALUES (
                    p_acao_id,
                    v_boleto_id,
                    v_valor_associado
                );
            END IF;
        END LOOP;
    END IF;

    -- [10] Verificação de Multi-Action e Determinação do Caminho (A vs B)
    IF p_plano_financeiro IS NOT NULL AND p_plano_financeiro <> 'null'::jsonb THEN
        v_is_caminho_b := TRUE;
    ELSE
        v_is_caminho_b := FALSE;
    END IF;

    IF v_is_caminho_b THEN
        -- CAMINHO B: Fechamento Simultâneo (Apuração + Plano Financeiro)
        -- Verificar se a campanha já possui histórico financeiro amortizado/liquidado
        IF v_campanha.tipo_plano_financeiro IN ('A_VISTA', 'PARCELADO') THEN
            SELECT COUNT(*) INTO v_pagamentos_count
            FROM public.cm_investimento_pagamentos
            WHERE campanha_id = v_campanha.id;

            SELECT COUNT(*) INTO v_parcelas_pagas_count
            FROM public.cm_investimento_parcelas
            WHERE campanha_id = v_campanha.id AND status_parcela != 'PENDENTE';

            IF v_pagamentos_count > 0 OR v_parcelas_pagas_count > 0 THEN
                RAISE EXCEPTION 'Operação Bloqueada: Campanha já possui histórico financeiro amortizado/liquidado. Não é permitido redefinir plano financeiro.';
            END IF;
        END IF;

        -- Prontidão Multi-Action: NENHUMA ação ativa pode estar em fase < 3
        SELECT COUNT(*) INTO v_acoes_nao_prontas
        FROM public.cm_acoes_investimento
        WHERE campanha_id = v_campanha.id
          AND cancel_reason IS NULL
          AND fase_atual < 3;

        IF v_acoes_nao_prontas > 0 THEN
            RAISE EXCEPTION 'Campanha não está apta ao fechamento financeiro. Existem % ação(ões) ativas que ainda não atingiram a Fase 3 (Apuração).', v_acoes_nao_prontas;
        END IF;

        -- Rigor Anti-Ambiguidade: Validar que TODAS as ações ativas da campanha possuem apuracao_valor_realizado preenchido
        -- (Proibição absoluta de COALESCE silencioso mascarando ações não apuradas)
        SELECT COUNT(*) INTO v_acoes_sem_apuracao
        FROM public.cm_acoes_investimento
        WHERE campanha_id = v_campanha.id
          AND cancel_reason IS NULL
          AND apuracao_valor_realizado IS NULL;

        IF v_acoes_sem_apuracao > 0 THEN
            RAISE EXCEPTION 'Campanha não está apta ao fechamento financeiro definitivo. Existem % ação(ões) ativas com apuração financeira pendente.', v_acoes_sem_apuracao;
        END IF;

        -- [11] Cálculo do Total Financeiro Canônico Realizado da Campanha: SUM(apuracao_valor_realizado)
        SELECT 
            COUNT(*), 
            COALESCE(SUM(apuracao_valor_realizado), 0.00),
            COALESCE(SUM(valor_investimento), 0.00)
        INTO 
            v_total_acoes_count, 
            v_total_campanha,
            v_total_projetado_campanha
        FROM public.cm_acoes_investimento
        WHERE campanha_id = v_campanha.id
          AND cancel_reason IS NULL;

        IF v_total_acoes_count = 0 THEN
            RAISE EXCEPTION 'Campanha % não possui ações ativas elegíveis para fechamento financeiro.', v_campanha.id;
        END IF;

        -- [12] Validação do Plano Financeiro
        v_tipo_plano := UPPER(TRIM(COALESCE(p_plano_financeiro->>'tipo_plano', '')));
        IF v_tipo_plano NOT IN ('A_VISTA', 'PARCELADO') THEN
            RAISE EXCEPTION 'Tipo de plano financeiro inválido: (%). Deve ser A_VISTA ou PARCELADO.', (p_plano_financeiro->>'tipo_plano');
        END IF;

        v_parcelas := p_plano_financeiro->'parcelas';
        IF v_parcelas IS NULL OR jsonb_typeof(v_parcelas) <> 'array' OR jsonb_array_length(v_parcelas) = 0 THEN
            RAISE EXCEPTION 'Ao menos uma parcela deve ser informada no plano financeiro.';
        END IF;

        IF v_tipo_plano = 'A_VISTA' AND jsonb_array_length(v_parcelas) <> 1 THEN
            RAISE EXCEPTION 'Plano A_VISTA deve conter exatamente 1 parcela. Recebido: %.', jsonb_array_length(v_parcelas);
        END IF;

        -- Validação de cada parcela
        v_total_parcelas := 0.00;
        v_count_parcelas := 0;

        FOR v_parc IN SELECT * FROM jsonb_array_elements(v_parcelas) LOOP
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
            RAISE EXCEPTION 'Inconsistência Financeira: A soma das parcelas (R$ %) diverge do valor total realizado da campanha (R$ %). Diferença: R$ %',
                v_total_parcelas, v_total_campanha, (v_total_campanha - v_total_parcelas);
        END IF;

        -- [13] Criação / Substituição das Parcelas
        DELETE FROM public.cm_investimento_parcelas
        WHERE campanha_id = v_campanha.id AND status_parcela = 'PENDENTE';

        v_idx := 0;
        FOR v_parc IN SELECT * FROM jsonb_array_elements(v_parcelas) LOOP
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
                v_campanha.id,
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

        -- [14] Atualização da Campanha
        UPDATE public.cm_campanhas
        SET
            tipo_plano_financeiro = v_tipo_plano,
            saldo_financeiro_devedor = v_total_campanha, -- Compromisso financeiro efetivo apurado
            valor_total_projetado = COALESCE(valor_total_projetado, v_total_projetado_campanha), -- Preserva o orçamento planejado original
            updated_at = timezone('utc'::text, now())
        WHERE id = v_campanha.id;

    ELSE
        -- CAMINHO A: Apuração isolada da ação. A campanha permanece inalterada em seu estado financeiro.
        v_tipo_plano := v_campanha.tipo_plano_financeiro;
        v_total_campanha := v_campanha.saldo_financeiro_devedor;
        v_count_parcelas := 0;
    END IF;

    -- [15] Auditoria Forense (cm_audit_logs)
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_campanhas',
        'CONCLUIR_FECHAMENTO_INVESTIMENTO',
        v_effective_user_id,
        jsonb_build_object(
            'acao_id', p_acao_id,
            'campanha_id', v_campanha.id,
            'caminho', CASE WHEN v_is_caminho_b THEN 'CAMINHO_B' ELSE 'CAMINHO_A' END,
            'fase_atual', 4,
            'tipo_plano', v_tipo_plano,
            'valor_total', v_total_campanha,
            'quantidade_parcelas', v_count_parcelas,
            'total_boletos_vinculados', v_total_vinculos,
            'primeiro_boleto_id', v_primeiro_boleto_id,
            'sem_boleto', COALESCE(p_sem_boleto, FALSE),
            'saldo_financeiro_devedor', v_total_campanha,
            'idempotency_key', p_idempotency_key,
            'preenchido_por', COALESCE(p_user_email, 'unknown'),
            'timestamp', timezone('utc'::text, now())
        )
    );

    -- [16] Retorno Estruturado
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'action_id', p_acao_id,
        'campanha_id', v_campanha.id,
        'caminho', CASE WHEN v_is_caminho_b THEN 'CAMINHO_B' ELSE 'CAMINHO_A' END,
        'fase_atual', 4,
        'tipo_plano', v_tipo_plano,
        'valor_total', v_total_campanha,
        'total_parcelas', v_count_parcelas,
        'saldo_financeiro_devedor', v_total_campanha,
        'total_boletos_vinculados', v_total_vinculos,
        'primeiro_boleto_id', v_primeiro_boleto_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_fechamento_investimento_completo_v1(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, JSONB, JSONB, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_fechamento_investimento_completo_v1(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, JSONB, JSONB, TEXT, UUID, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.concluir_fechamento_investimento_completo_v1(UUID, TEXT, INTEGER, NUMERIC, TEXT, TEXT, BOOLEAN, TEXT, JSONB, JSONB, TEXT, UUID, TEXT) IS
'RDM Gate 5.17 Fase 2: Fechamento financeiro realizado por ação e paridade com Plano Financeiro da Campanha. Exige apuração concluída de todas as ações ativas em Caminho B (sem COALESCE cego) e consolida v_total_campanha como SUM(apuracao_valor_realizado).';

COMMIT;
