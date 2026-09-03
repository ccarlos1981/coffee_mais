-- Migration: 20260903_exclusao_governada_acoes.sql
-- Description: Implementação da RPC de Exclusão Governada de Ações de Investimento (Gate 5.7)
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED (Alteração Pontual de Governança)

-- 1. CRIAÇÃO DA RPC ATÔMICA excluir_acao_investimento_v1
CREATE OR REPLACE FUNCTION public.excluir_acao_investimento_v1(
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
    v_campanha RECORD;
BEGIN
    -- [A] Identificação Canônica do Usuário
    v_auth_uid := auth.uid();
    v_auth_role := auth.role();

    IF v_auth_role = 'authenticated' OR v_auth_uid IS NOT NULL THEN
        -- Contexto autenticado via JWT: p_user_id deve coincidir com auth.uid() se fornecido
        IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: Identidade p_user_id divergente do token autenticado auth.uid().';
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSIF v_auth_role = 'service_role' OR (v_auth_uid IS NULL AND current_user = 'postgres') THEN
        -- Contexto de serviço/Server Action autenticado no backend
        v_effective_user_id := p_user_id;
    ELSE
        v_effective_user_id := COALESCE(v_auth_uid, p_user_id);
    END IF;

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Identidade do usuário não informada.';
    END IF;

    -- [B] Validação do Perfil e Role (TODOS os perfis autenticados e aprovados permitidos)
    SELECT * INTO v_user_profile 
    FROM public.cm_user_profiles 
    WHERE id = v_effective_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil do usuário % não encontrado em cm_user_profiles.', v_effective_user_id;
    END IF;

    IF COALESCE(v_user_profile.approved, false) = false THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil % não está aprovado.', v_effective_user_id;
    END IF;

    -- Obter e-mail institucional a partir de auth.users
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_effective_user_id;

    -- [C] Carregamento da Ação com Lock Transacional (Prevenção de Concorrência e Duplo Clique)
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

    -- [D] Validação Estrita de Ownership de Carteira para Gerente Regional
    IF v_user_profile.role = 'Gerente Regional' THEN
        DECLARE
            v_is_owner BOOLEAN := false;
            v_manager_nome TEXT;
            v_user_name_clean TEXT;
            v_manager_name_clean TEXT;
            v_user_email_prefix TEXT;
            v_resolved_clean TEXT;
        BEGIN
            -- 1. Se a campanha possui autor/gerente_id igual ao usuário
            IF v_acao.campanha_id IS NOT NULL THEN
                SELECT * INTO v_campanha 
                FROM public.cm_campanhas 
                WHERE id = v_acao.campanha_id;

                IF v_campanha.gerente_id IS NOT NULL AND v_campanha.gerente_id = v_effective_user_id THEN
                    v_is_owner := true;
                END IF;
            END IF;

            -- 2. Resolução do Gerente da Ação / Rede / Cliente
            IF NOT v_is_owner THEN
                SELECT 
                    COALESCE(
                        (SELECT rm.manager FROM public.cm_redes_matrizes rm WHERE rm.codigo = v_acao.codigo_matriz LIMIT 1),
                        (SELECT rm.manager FROM public.cm_redes_matrizes rm WHERE UPPER(TRIM(rm.nome)) = UPPER(TRIM(v_acao.rede)) LIMIT 1),
                        (SELECT c_loja.responsavel FROM public.cm_clientes c_loja WHERE c_loja.codigo = v_acao.codigo LIMIT 1),
                        (SELECT c_matriz.responsavel FROM public.cm_clientes c_matriz WHERE c_matriz.codigo_matriz = v_acao.codigo_matriz AND c_matriz.responsavel IS NOT NULL LIMIT 1)
                    ) INTO v_manager_nome;

                v_user_name_clean := UPPER(REGEXP_REPLACE(COALESCE(v_user_profile.name, ''), '[^a-zA-Z0-9]', '', 'g'));
                v_manager_name_clean := UPPER(REGEXP_REPLACE(COALESCE(v_user_profile.manager_name, ''), '[^a-zA-Z0-9]', '', 'g'));
                v_user_email_prefix := UPPER(REGEXP_REPLACE(SPLIT_PART(COALESCE(v_user_email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g'));

                IF v_manager_nome IS NOT NULL THEN
                    v_resolved_clean := UPPER(REGEXP_REPLACE(v_manager_nome, '[^a-zA-Z0-9]', '', 'g'));
                    IF (v_user_name_clean <> '' AND (v_resolved_clean LIKE v_user_name_clean || '%' OR v_user_name_clean LIKE v_resolved_clean || '%'))
                       OR (v_manager_name_clean <> '' AND (v_resolved_clean LIKE v_manager_name_clean || '%' OR v_manager_name_clean LIKE v_resolved_clean || '%'))
                       OR (v_user_email_prefix <> '' AND (v_resolved_clean LIKE v_user_email_prefix || '%' OR v_user_email_prefix LIKE v_resolved_clean || '%')) THEN
                        v_is_owner := true;
                    END IF;
                END IF;
            END IF;

            IF NOT v_is_owner THEN
                RAISE EXCEPTION 'Acesso Negado: esta ação pertence à carteira de outro gerente comercial.';
            END IF;
        END;
    END IF;

    -- [E] Validação de Fase e Estado de Planejamento
    IF COALESCE(v_acao.is_planejamento, false) = true THEN
        -- Planejamento: verificar se já foi oficializado
        IF (v_acao.approved_snapshot IS NOT NULL AND v_acao.approved_snapshot->>'origem_planejamento_id' IS NOT NULL)
           OR EXISTS (
               SELECT 1 FROM public.cm_acoes_investimento 
               WHERE approved_snapshot->>'origem_planejamento_id' = p_acao_id::text
           ) THEN
            RAISE EXCEPTION 'Operação Bloqueada: Planejamento já oficializado não pode ser excluído fisicamente. O snapshot orçamentário deve ser preservado.';
        END IF;
    ELSE
        -- Ação Oficial: exclusão permitida estritamente na Fase 1 (Planej. GRV)
        IF COALESCE(v_acao.fase_atual, 1) > 1 THEN
            RAISE EXCEPTION 'Operação Bloqueada: Ações em Fase % não podem ser excluídas fisicamente. Utilize o fluxo operacional adequado (Ação Não Ocorreu na Fase 2/3 ou Devolução no Trade).', v_acao.fase_atual;
        END IF;
    END IF;

    -- [F] Validação Estrita de Dependências Financeiras (Regra Canônica)
    -- 1. Qualquer parcela vinculada à campanha bloqueia o DELETE físico
    IF v_acao.campanha_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.cm_investimento_parcelas 
        WHERE campanha_id = v_acao.campanha_id
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada: Esta ação possui plano financeiro de parcelas vinculado à negociação. Ajustes exigem renegociação formal.';
    END IF;

    -- 2. Qualquer pagamento registrado na campanha bloqueia o DELETE físico
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

    -- 4. Vínculo com boleto já quitado ou baixado
    IF EXISTS (
        SELECT 1 FROM public.cm_acoes_boletos_vinculo vb
        JOIN public.cm_boletos b ON b.id = vb.boleto_id
        WHERE vb.acao_id = p_acao_id AND b.status IN ('PAGO', 'BAIXADO', 'QUITADO')
    ) THEN
        RAISE EXCEPTION 'Operação Bloqueada: Esta ação possui vínculo com boleto já quitado/baixado.';
    END IF;

    -- [G] Registro Atômico de Auditoria Forense com Snapshot Completo Prévio
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        old_data,
        new_data
    ) VALUES (
        'cm_acoes_investimento',
        'DELETE',
        v_effective_user_id,
        jsonb_build_object(
            'id', v_acao.id,
            'codigo', v_acao.codigo,
            'rede', v_acao.rede,
            'codigo_matriz', v_acao.codigo_matriz,
            'campanha_id', v_acao.campanha_id,
            'fase_atual', v_acao.fase_atual,
            'is_planejamento', v_acao.is_planejamento,
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
            'motivo_exclusao', p_motivo,
            'deleted_by_role', v_user_profile.role,
            'deleted_by_name', v_user_profile.name,
            'deleted_by_id', v_effective_user_id,
            'deleted_at', now()
        ),
        NULL
    );

    -- [H] Remoção em Cascata Segura dos Registros Dependentes Auxiliares
    DELETE FROM public.cm_acoes_boletos_vinculo WHERE acao_id = p_acao_id;
    DELETE FROM public.cm_acoes_email_tracking WHERE acao_id = p_acao_id;
    DELETE FROM public.cm_investimento_familias WHERE investimento_id = p_acao_id;
    UPDATE public.cm_acoes_investimento SET acao_origem_recorrencia_id = NULL WHERE acao_origem_recorrencia_id = p_acao_id;

    -- [I] Exclusão Física Definitiva da Ação
    DELETE FROM public.cm_acoes_investimento WHERE id = p_acao_id;

    -- [J] Recálculo Agregado da Campanha Pai (PRESERVANDO cm_campanhas sem exclusão automática)
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
        'message', 'Ação comercial excluída com sucesso.'
    );
END;
$$;

-- 2. AJUSTE DE PRIVILÉGIOS E GRANTS DA RPC
REVOKE ALL ON FUNCTION public.excluir_acao_investimento_v1(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_acao_investimento_v1(UUID, TEXT, UUID) TO authenticated, service_role;
