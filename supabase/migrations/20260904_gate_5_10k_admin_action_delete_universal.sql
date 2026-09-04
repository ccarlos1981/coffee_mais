-- Migration: 20260904_gate_5_10k_admin_action_delete_universal.sql
-- Description: Gate 5.10K - Criação da RPC soberana excluir_acao_investimento_admin_v1 para permitir exclusão administrativa de ações reais e de teste (is_test = TRUE ou FALSE) em todas as fases operacionais (Fases 1 a 6) exclusivamente para perfis Trade e Admin, preservando integralmente o Financial Guard e a integridade financeira.
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED

CREATE OR REPLACE FUNCTION public.excluir_acao_investimento_admin_v1(
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
    v_audit_action TEXT;
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

    -- [C] Carregamento da Ação com Lock Transacional FOR UPDATE (Prevenção de Concorrência)
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

    -- [D] Validação de Fases Permitidas (Gate 5.10K: Fases 1 a 6 são permitidas para Trade/Admin)
    v_fase := COALESCE(v_acao.fase_atual, 1);
    IF v_fase < 1 OR v_fase > 6 THEN
        RAISE EXCEPTION 'Operação Bloqueada: Fase inválida (%).', v_fase;
    END IF;

    -- [E] Bloqueio Financeiro Absoluto (Financial Guard: Nenhuma dependência financeira permitida)
    -- 1. Qualquer parcela vinculada à campanha (futuras, pendentes, parciais ou quitadas)
    IF v_acao.campanha_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.cm_investimento_parcelas 
        WHERE campanha_id = v_acao.campanha_id
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada pelo Financial Guard: Esta ação possui plano financeiro de parcelas vinculado à negociação.';
    END IF;

    -- 2. Qualquer pagamento registrado na campanha
    IF v_acao.campanha_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.cm_investimento_pagamentos 
        WHERE campanha_id = v_acao.campanha_id
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada pelo Financial Guard: Esta ação possui pagamentos registrados vinculados à negociação.';
    END IF;

    -- 3. Ação com confirmação de pagamento financeiro
    IF v_acao.financeiro_pago_em IS NOT NULL THEN
        RAISE EXCEPTION 'Operação Bloqueada pelo Financial Guard: Ação com pagamento confirmado no Financeiro não pode ser excluída.';
    END IF;

    -- 4. Vínculo formal com boletos ou apuracao_boleto_id
    IF EXISTS (
        SELECT 1 FROM public.cm_acoes_boletos_vinculo 
        WHERE acao_id = p_acao_id
    ) OR v_acao.apuracao_boleto_id IS NOT NULL THEN
        RAISE EXCEPTION 'Operação Bloqueada pelo Financial Guard: Esta ação possui vínculo formal com boletos na negociação.';
    END IF;

    -- [F] Definição Semântica da Ação de Auditoria
    IF COALESCE(v_acao.is_test, false) = true THEN
        v_audit_action := 'ADMIN_TEST_DELETE';
    ELSE
        v_audit_action := 'ADMIN_DELETE';
    END IF;

    -- [G] Registro Atômico de Auditoria Forense com Snapshot Completo
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
            'motivo_exclusao', COALESCE(p_motivo, 'Exclusão administrativa de ação'),
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

    -- [I] Exclusão Física Definitiva da Ação
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
        'is_test', COALESCE(v_acao.is_test, false),
        'message', 'Ação excluída com sucesso via operação administrativa.'
    );
END;
$$;

-- Ajuste de Privilégios e Grants da RPC
REVOKE ALL ON FUNCTION public.excluir_acao_investimento_admin_v1(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_acao_investimento_admin_v1(UUID, TEXT, UUID) TO authenticated, service_role;
