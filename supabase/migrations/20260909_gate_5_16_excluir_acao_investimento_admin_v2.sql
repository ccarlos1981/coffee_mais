-- Migration: 20260909_gate_5_16_excluir_acao_investimento_admin_v2.sql
-- Description: Gate 5.16 - Criação da RPC soberana excluir_acao_investimento_admin_v2 com governança financeira anti-ambiguidade, suporte a cancelamento de compromissos futuros e adição do status CANCELADA_EXCLUSAO_ACAO em cm_investimento_parcelas.
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED & GATE_5_15B_CONGELADO

-- ==============================================================================
-- 1. EXTENSÃO DA CONSTRAINT DE STATUS DE PARCELAS EM cm_investimento_parcelas
-- ==============================================================================

ALTER TABLE public.cm_investimento_parcelas 
  DROP CONSTRAINT IF EXISTS cm_investimento_parcelas_status_parcela_check;

ALTER TABLE public.cm_investimento_parcelas 
  ADD CONSTRAINT cm_investimento_parcelas_status_parcela_check 
  CHECK (status_parcela = ANY (ARRAY[
    'PENDENTE'::text, 
    'PARCIALMENTE_PAGA'::text, 
    'QUITADA'::text, 
    'CANCELADA_QUITACAO_ANTECIPADA'::text, 
    'CANCELADA_RENEGOCIACAO'::text,
    'CANCELADA_EXCLUSAO_ACAO'::text
  ]));

-- ==============================================================================
-- 2. CRIAÇÃO DA RPC SOBERANA excluir_acao_investimento_admin_v2
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.excluir_acao_investimento_admin_v2(
    p_acao_id UUID,
    p_motivo TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_confirmar_cancelamento_futuro BOOLEAN DEFAULT true
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
    v_campanha RECORD;
    v_fase INTEGER;
    v_audit_action TEXT;

    -- Diagnóstico Financeiro
    v_acao_pago_direto BOOLEAN := false;
    v_boletos_abertos_count INTEGER := 0;
    v_boletos_pagos_count INTEGER := 0;
    v_total_acoes_historicas INTEGER := 0;
    v_outras_acoes_ativas_count INTEGER := 0;
    v_campanha_pagamentos_count INTEGER := 0;
    v_campanha_valor_pago NUMERIC(14,2) := 0.00;
    v_total_parcelas_count INTEGER := 0;
    v_parcelas_futuras_count INTEGER := 0;
    v_parcelas_futuras_saldo NUMERIC(14,2) := 0.00;
    v_parcelas_pagas_count INTEGER := 0;
    v_parcelas_valor_pago_acumulado NUMERIC(14,2) := 0.00;
    v_parcelas_parciais_count INTEGER := 0;
    v_parcelas_parciais_saldo NUMERIC(14,2) := 0.00;

    v_classificacao TEXT;
    v_novo_projetado NUMERIC(14,2) := 0.00;
    v_novo_devedor NUMERIC(14,2) := 0.00;
    v_novo_status_fin TEXT := 'ABERTA';
    v_novo_status_op TEXT := 'PLANEJAMENTO';
BEGIN
    -- [A] Identificação Canônica do Usuário e Prevenção Soberana de Spoofing
    v_auth_uid := auth.uid();
    v_auth_role := auth.role();

    IF v_auth_role = 'anon' THEN
        RAISE EXCEPTION 'Security Violation: Usuário anônimo (anon) não autorizado para exclusão administrativa.';
    END IF;

    IF v_auth_role = 'authenticated' OR v_auth_uid IS NOT NULL THEN
        IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: Identidade p_user_id divergente do token autenticado auth.uid().';
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSIF v_auth_role = 'service_role' OR (v_auth_uid IS NULL AND current_user = 'postgres') THEN
        v_effective_user_id := p_user_id;
    ELSE
        RAISE EXCEPTION 'Security Violation: Contexto de execução não autorizado.';
    END IF;

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Identidade do usuário não informada.';
    END IF;

    -- [B] Validação do Perfil e Role (RBAC Estrito: Apenas Trade e Admin)
    SELECT * INTO v_user_profile 
    FROM public.cm_user_profiles 
    WHERE id = v_effective_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil do usuário % não encontrado em cm_user_profiles.', v_effective_user_id;
    END IF;

    IF COALESCE(v_user_profile.approved, false) = false THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil % não está aprovado.', v_effective_user_id;
    END IF;

    IF TRIM(LOWER(v_user_profile.role)) NOT IN ('trade', 'admin') THEN
        RAISE EXCEPTION 'Acesso Negado: Apenas os perfis Trade e Admin possuem autorização para exclusão administrativa de ações (role atual: "%").', v_user_profile.role;
    END IF;

    -- [C] Concorrência: Locks Transacionais Pessimistas (Prevenção de Race Condition e Duplo Clique)
    PERFORM pg_advisory_xact_lock(hashtext('acao_mut_' || p_acao_id::text));

    SELECT * INTO v_acao 
    FROM public.cm_acoes_investimento 
    WHERE id = p_acao_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'code', 'NOT_FOUND',
            'message', 'Ação não encontrada ou já excluída.'
        );
    END IF;

    IF v_acao.campanha_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('campanha_mut_' || v_acao.campanha_id::text));

        SELECT * INTO v_campanha 
        FROM public.cm_campanhas 
        WHERE id = v_acao.campanha_id 
        FOR UPDATE;
    END IF;

    -- [D] Validação de Fases Permitidas (Gate 5.10K: Fases 1 a 6)
    v_fase := COALESCE(v_acao.fase_atual, 1);
    IF v_fase < 1 OR v_fase > 6 THEN
        RAISE EXCEPTION 'Operação Bloqueada: Fase inválida (%).', v_fase;
    END IF;

    -- [E] Diagnóstico Financeiro e Classificação de Risco (Financial Guard V2)
    -- 1. Confirmação direta de pagamento na ação
    IF v_acao.financeiro_pago_em IS NOT NULL THEN
        v_acao_pago_direto := true;
    END IF;

    -- 2. Vínculos de Boletos da Ação
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE b.status IN ('PAGO', 'BAIXADO', 'QUITADO')), 0),
        COALESCE(COUNT(*) FILTER (WHERE b.status NOT IN ('PAGO', 'BAIXADO', 'QUITADO')), 0)
    INTO v_boletos_pagos_count, v_boletos_abertos_count
    FROM public.cm_acoes_boletos_vinculo vb
    JOIN public.cm_boletos b ON b.id = vb.boleto_id
    WHERE vb.acao_id = p_acao_id;

    IF v_acao.apuracao_boleto_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.cm_boletos WHERE id = v_acao.apuracao_boleto_id AND status IN ('PAGO', 'BAIXADO', 'QUITADO')) THEN
            v_boletos_pagos_count := v_boletos_pagos_count + 1;
        ELSE
            v_boletos_abertos_count := v_boletos_abertos_count + 1;
        END IF;
    END IF;

    -- 3. Contexto da Campanha (Parcelas, Pagamentos e Multi-Ações)
    IF v_acao.campanha_id IS NOT NULL THEN
        -- Contagem de ações históricas da campanha
        SELECT COUNT(*) INTO v_total_acoes_historicas
        FROM public.cm_acoes_investimento
        WHERE campanha_id = v_acao.campanha_id;

        -- Contagem de outras ações ativas na mesma campanha
        SELECT COUNT(*) INTO v_outras_acoes_ativas_count
        FROM public.cm_acoes_investimento
        WHERE campanha_id = v_acao.campanha_id 
          AND id <> p_acao_id 
          AND cancel_reason IS NULL;

        -- Pagamentos realizados na campanha
        SELECT 
            COALESCE(COUNT(*), 0),
            COALESCE(SUM(valor_pago), 0.00)
        INTO v_campanha_pagamentos_count, v_campanha_valor_pago
        FROM public.cm_investimento_pagamentos
        WHERE campanha_id = v_acao.campanha_id;

        -- Grade de parcelas da campanha
        SELECT 
            COALESCE(COUNT(*), 0),
            COALESCE(COUNT(*) FILTER (WHERE status_parcela = 'PENDENTE' AND valor_pago_acumulado = 0.00), 0),
            COALESCE(SUM(saldo_remanescente) FILTER (WHERE status_parcela = 'PENDENTE' AND valor_pago_acumulado = 0.00), 0.00),
            COALESCE(COUNT(*) FILTER (WHERE valor_pago_acumulado > 0.00), 0),
            COALESCE(SUM(valor_pago_acumulado), 0.00),
            COALESCE(COUNT(*) FILTER (WHERE status_parcela = 'PARCIALMENTE_PAGA' AND saldo_remanescente > 0.00), 0),
            COALESCE(SUM(saldo_remanescente) FILTER (WHERE status_parcela = 'PARCIALMENTE_PAGA' AND saldo_remanescente > 0.00), 0.00)
        INTO 
            v_total_parcelas_count,
            v_parcelas_futuras_count,
            v_parcelas_futuras_saldo,
            v_parcelas_pagas_count,
            v_parcelas_valor_pago_acumulado,
            v_parcelas_parciais_count,
            v_parcelas_parciais_saldo
        FROM public.cm_investimento_parcelas
        WHERE campanha_id = v_acao.campanha_id;
    END IF;

    -- [F] Motor de Decisão da Máquina de Estados
    -- F.1: Hard Gate Multi-Ações (Decisão Executiva 1 / Opção A)
    IF (v_outras_acoes_ativas_count > 0 AND (v_total_parcelas_count > 0 OR v_campanha_pagamentos_count > 0))
       OR (v_total_acoes_historicas > 1 AND (v_campanha_pagamentos_count > 0 OR v_parcelas_pagas_count > 0)) THEN
        v_classificacao := 'MULTI_ACTION_FINANCIAL_AMBIGUOUS';

        RETURN jsonb_build_object(
            'success', false,
            'code', 'MULTI_ACTION_FINANCIAL_AMBIGUOUS',
            'error', 'Operação Bloqueada: Esta ação pertence a uma negociação com múltiplas ações e compromissos financeiros compartilhados. Ajuste o plano de parcelas da negociação master antes da exclusão individual.'
        );
    END IF;

    -- F.2: Histórico Totalmente Realizado / Liquidado
    IF v_acao_pago_direto 
       OR v_boletos_pagos_count > 0 
       OR (v_parcelas_pagas_count > 0 AND v_parcelas_futuras_count = 0 AND v_parcelas_parciais_count = 0)
       OR (v_campanha_pagamentos_count > 0 AND COALESCE(v_campanha.saldo_financeiro_devedor, 0) <= 0.001) THEN
        v_classificacao := 'FULLY_REALIZED';

        RETURN jsonb_build_object(
            'success', false,
            'code', 'FULLY_REALIZED',
            'error', 'Operação Bloqueada: Ação com histórico financeiro liquidado/confirmado não pode ser excluída fisicamente. Preservação contábil obrigatória.'
        );
    END IF;

    -- F.3: Amortização Parcial com Saldo Futuro Remanescente
    IF (v_parcelas_pagas_count > 0 OR v_campanha_pagamentos_count > 0)
       AND (v_parcelas_futuras_count > 0 OR v_parcelas_parciais_count > 0) THEN
        v_classificacao := 'PARTIAL_REALIZED';
    -- F.4: Compromissos Estritamente Futuros
    ELSIF (v_parcelas_futuras_count > 0 OR v_boletos_abertos_count > 0)
       AND v_parcelas_pagas_count = 0 
       AND v_campanha_pagamentos_count = 0 
       AND v_boletos_pagos_count = 0 
       AND NOT v_acao_pago_direto THEN
        v_classificacao := 'FUTURE_ONLY';
    -- F.5: Totalmente Limpa de Vínculos Financeiros
    ELSE
        v_classificacao := 'CLEAN';
    END IF;

    -- [G] Execução Transacional Determinística por Estado

    -- =========================================================================
    -- CASO 1: PARTIAL_REALIZED (Soft-Cancel com Blindagem do Gate 5.15B)
    -- =========================================================================
    IF v_classificacao = 'PARTIAL_REALIZED' THEN
        -- 1. Cancelar parcelas 100% pendentes
        UPDATE public.cm_investimento_parcelas
        SET
            status_parcela = 'CANCELADA_EXCLUSAO_ACAO',
            saldo_remanescente = 0.00,
            observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelada por encerramento de ação: ' || COALESCE(p_motivo, 'Exclusão administrativa'),
            updated_at = timezone('utc'::text, now())
        WHERE campanha_id = v_acao.campanha_id
          AND status_parcela = 'PENDENTE'
          AND valor_pago_acumulado = 0.00;

        -- 2. Zerar saldo remanescente em parcelas parcialmente pagas
        UPDATE public.cm_investimento_parcelas
        SET
            saldo_remanescente = 0.00,
            observacoes = COALESCE(observacoes || ' | ', '') || 'Saldo remanescente cancelado: ' || COALESCE(p_motivo, 'Exclusão administrativa'),
            updated_at = timezone('utc'::text, now())
        WHERE campanha_id = v_acao.campanha_id
          AND status_parcela = 'PARCIALMENTE_PAGA'
          AND saldo_remanescente > 0.00;

        -- 3. Desvincular boletos abertos (mantém títulos no ERP intactos)
        DELETE FROM public.cm_acoes_boletos_vinculo WHERE acao_id = p_acao_id;

        -- 4. Encerramento Operacional da Ação (PRESERVANDO valor_investimento TOTAL conforme Gate 5.15B)
        UPDATE public.cm_acoes_investimento
        SET
            fase_atual = 6,
            cancel_reason = 'ENCERRAMENTO_ANTECIPADO_SALDO_CANCELADO',
            updated_at = timezone('utc'::text, now())
        WHERE id = p_acao_id;

        -- 5. Reconciliação Contábil da Campanha
        IF v_acao.campanha_id IS NOT NULL THEN
            UPDATE public.cm_campanhas
            SET
                saldo_financeiro_devedor = 0.00,
                status_financeiro = 'PARCIALMENTE_ABATIDA',
                status_operacional = 'CONCLUIDA',
                updated_at = timezone('utc'::text, now())
            WHERE id = v_acao.campanha_id;
        END IF;

        -- 6. Auditoria Forense
        INSERT INTO public.cm_audit_logs (
            table_name,
            action,
            user_id,
            old_data,
            new_data
        ) VALUES (
            'cm_acoes_investimento',
            'ADMIN_CANCEL_REALIZED_PRESERVED',
            v_effective_user_id,
            jsonb_build_object(
                'id', v_acao.id,
                'codigo', v_acao.codigo,
                'campanha_id', v_acao.campanha_id,
                'classificacao', 'PARTIAL_REALIZED',
                'valor_investimento_total', v_acao.valor_investimento,
                'valor_realizado_preservado', v_parcelas_valor_pago_acumulado,
                'saldo_futuro_cancelado', (v_parcelas_futuras_saldo + v_parcelas_parciais_saldo),
                'motivo', p_motivo,
                'timestamp', now()
            ),
            NULL
        );

        RETURN jsonb_build_object(
            'success', true,
            'operation', 'SOFT_CANCEL_PRESERVED',
            'code', 'PARTIAL_REALIZED',
            'acao_id', p_acao_id,
            'campanha_id', v_acao.campanha_id,
            'valor_investimento_total', v_acao.valor_investimento,
            'valor_realizado_preservado', v_parcelas_valor_pago_acumulado,
            'saldo_futuro_cancelado', (v_parcelas_futuras_saldo + v_parcelas_parciais_saldo),
            'message', 'Saldo futuro cancelado com sucesso. Histórico financeiro realizado preservado integralmente.'
        );

    -- =========================================================================
    -- CASO 2: FUTURE_ONLY (Cancelamento Futuro e Exclusão Física de Mono-Ação)
    -- =========================================================================
    ELSIF v_classificacao = 'FUTURE_ONLY' THEN
        -- 1. Cancelar todas as parcelas pendentes da Mono-Ação
        UPDATE public.cm_investimento_parcelas
        SET
            status_parcela = 'CANCELADA_EXCLUSAO_ACAO',
            saldo_remanescente = 0.00,
            observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelada por exclusão de ação: ' || COALESCE(p_motivo, 'Exclusão administrativa'),
            updated_at = timezone('utc'::text, now())
        WHERE campanha_id = v_acao.campanha_id
          AND status_parcela = 'PENDENTE'
          AND valor_pago_acumulado = 0.00;

        -- 2. Desvincular boletos em aberto (sem alterar títulos no ERP)
        DELETE FROM public.cm_acoes_boletos_vinculo WHERE acao_id = p_acao_id;

        -- 3. Limpar vínculos auxiliares locais
        DELETE FROM public.cm_acoes_email_tracking WHERE acao_id = p_acao_id;
        DELETE FROM public.cm_investimento_familias WHERE investimento_id = p_acao_id;
        UPDATE public.cm_acoes_investimento SET acao_origem_recorrencia_id = NULL WHERE acao_origem_recorrencia_id = p_acao_id;

        -- 4. Registro de Auditoria Forense
        INSERT INTO public.cm_audit_logs (
            table_name,
            action,
            user_id,
            old_data,
            new_data
        ) VALUES (
            'cm_acoes_investimento',
            'ADMIN_DELETE_FUTURE_CANCELED',
            v_effective_user_id,
            jsonb_build_object(
                'id', v_acao.id,
                'codigo', v_acao.codigo,
                'rede', v_acao.rede,
                'campanha_id', v_acao.campanha_id,
                'classificacao', 'FUTURE_ONLY',
                'valor_investimento', v_acao.valor_investimento,
                'parcelas_canceladas_count', v_parcelas_futuras_count,
                'saldo_cancelado', v_parcelas_futuras_saldo,
                'motivo_exclusao', COALESCE(p_motivo, 'Exclusão administrativa com cancelamento de compromisso futuro'),
                'deleted_by_role', v_user_profile.role,
                'deleted_by_id', v_effective_user_id,
                'deleted_at', now()
            ),
            NULL
        );

        -- 5. Exclusão Física da Ação
        DELETE FROM public.cm_acoes_investimento WHERE id = p_acao_id;

        -- 6. Reconciliação Contábil da Campanha Pai
        IF v_acao.campanha_id IS NOT NULL THEN
            UPDATE public.cm_campanhas
            SET
                valor_total_projetado = 0.00,
                saldo_financeiro_devedor = 0.00,
                status_operacional = 'CANCELADA',
                updated_at = timezone('utc'::text, now())
            WHERE id = v_acao.campanha_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'operation', 'PHYSICAL_DELETE',
            'code', 'FUTURE_ONLY',
            'acao_id', p_acao_id,
            'campanha_id', v_acao.campanha_id,
            'deleted_rows', 1,
            'parcelas_canceladas', v_parcelas_futuras_count,
            'saldo_cancelado', v_parcelas_futuras_saldo,
            'message', 'Compromissos futuros cancelados e ação excluída com sucesso.'
        );

    -- =========================================================================
    -- CASO 3: CLEAN (Exclusão Física Pura)
    -- =========================================================================
    ELSE
        -- 1. Remoção de Vínculos Auxiliares
        DELETE FROM public.cm_acoes_boletos_vinculo WHERE acao_id = p_acao_id;
        DELETE FROM public.cm_acoes_email_tracking WHERE acao_id = p_acao_id;
        DELETE FROM public.cm_investimento_familias WHERE investimento_id = p_acao_id;
        UPDATE public.cm_acoes_investimento SET acao_origem_recorrencia_id = NULL WHERE acao_origem_recorrencia_id = p_acao_id;

        IF COALESCE(v_acao.is_test, false) = true THEN
            v_audit_action := 'ADMIN_TEST_DELETE';
        ELSE
            v_audit_action := 'ADMIN_DELETE_CLEAN';
        END IF;

        -- 2. Registro de Auditoria Forense
        INSERT INTO public.cm_audit_logs (
            table_name,
            action,
            user_id,
            old_data,
            new_data
        ) VALUES (
            'cm_acoes_investimento',
            v_audit_action,
            v_effective_user_id,
            jsonb_build_object(
                'id', v_acao.id,
                'codigo', v_acao.codigo,
                'rede', v_acao.rede,
                'campanha_id', v_acao.campanha_id,
                'classificacao', 'CLEAN',
                'valor_investimento', v_acao.valor_investimento,
                'is_test', v_acao.is_test,
                'motivo_exclusao', COALESCE(p_motivo, 'Exclusão administrativa limpa'),
                'deleted_by_role', v_user_profile.role,
                'deleted_by_id', v_effective_user_id,
                'deleted_at', now()
            ),
            NULL
        );

        -- 3. Exclusão Física da Ação
        DELETE FROM public.cm_acoes_investimento WHERE id = p_acao_id;

        -- 4. Reconciliação Agregada da Campanha Pai
        IF v_acao.campanha_id IS NOT NULL THEN
            SELECT 
                COALESCE(SUM(valor_investimento), 0.00) INTO v_novo_projetado
            FROM public.cm_acoes_investimento 
            WHERE campanha_id = v_acao.campanha_id AND cancel_reason IS NULL;

            SELECT 
                COALESCE(SUM(saldo_remanescente), 0.00) INTO v_novo_devedor
            FROM public.cm_investimento_parcelas 
            WHERE campanha_id = v_acao.campanha_id 
              AND status_parcela NOT IN ('CANCELADA_QUITACAO_ANTECIPADA', 'CANCELADA_RENEGOCIACAO', 'CANCELADA_EXCLUSAO_ACAO');

            IF v_novo_projetado = 0.00 THEN
                v_novo_status_op := 'CANCELADA';
            ELSE
                v_novo_status_op := COALESCE(v_campanha.status_operacional, 'PLANEJAMENTO');
            END IF;

            UPDATE public.cm_campanhas
            SET
                valor_total_projetado = v_novo_projetado,
                saldo_financeiro_devedor = v_novo_devedor,
                status_operacional = v_novo_status_op,
                updated_at = now()
            WHERE id = v_acao.campanha_id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'operation', 'PHYSICAL_DELETE',
            'code', 'CLEAN',
            'acao_id', p_acao_id,
            'campanha_id', v_acao.campanha_id,
            'deleted_rows', 1,
            'is_test', COALESCE(v_acao.is_test, false),
            'message', 'Ação excluída com sucesso via operação administrativa limpa.'
        );
    END IF;
END;
$$;

-- ==============================================================================
-- 3. AJUSTE DE PRIVILÉGIOS E GRANTS DA RPC v2
-- ==============================================================================

REVOKE ALL ON FUNCTION public.excluir_acao_investimento_admin_v2(UUID, TEXT, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.excluir_acao_investimento_admin_v2(UUID, TEXT, UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.excluir_acao_investimento_admin_v2(UUID, TEXT, UUID, BOOLEAN) TO authenticated, service_role;
