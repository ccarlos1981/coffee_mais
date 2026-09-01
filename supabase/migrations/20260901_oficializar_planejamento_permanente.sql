-- ==============================================================================
-- COFFEE++ — PLANEJAMENTO PERMANENTE DE INVESTIMENTOS & OFICIALIZAÇÃO SEGURA
-- Migration: 20260901_oficializar_planejamento_permanente.sql
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED
-- ==============================================================================

-- 1. Atualizar constraint de actions permitidas em cm_audit_logs
ALTER TABLE public.cm_audit_logs 
  DROP CONSTRAINT IF EXISTS cm_audit_logs_action_check;

ALTER TABLE public.cm_audit_logs 
  ADD CONSTRAINT cm_audit_logs_action_check 
  CHECK (action = ANY (ARRAY[
    'INSERT'::text, 
    'UPDATE'::text, 
    'DELETE'::text, 
    'Acesso'::text, 
    'Login'::text, 
    'EXCECAO_AUDITORIA_TRADE'::text, 
    'CAMPAIGN_MANAGER_FALLBACK'::text, 
    'TRADE_REJECT'::text,
    'OFICIALIZAR_PLANEJAMENTO'::text
  ]));

-- 2. Índice Físico de Unicidade Parcial para Idempotency Keys de Oficialização
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_audit_logs_oficializar_idempotency_key 
ON public.cm_audit_logs ((new_data->>'idempotency_key')) 
WHERE action = 'OFICIALIZAR_PLANEJAMENTO' AND new_data->>'idempotency_key' IS NOT NULL;

-- 3. RPC Transacional Soberana de Oficialização de Planejamento
CREATE OR REPLACE FUNCTION public.oficializar_planejamento_v1(
    p_planejamento_id UUID,
    p_user_id UUID,
    p_idempotency_key TEXT
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
    v_plan RECORD;
    v_campanha_origem RECORD;
    v_campanha_id UUID;
    v_nova_acao_id UUID;
    v_existing_audit RECORD;
    v_current_snapshot_hash TEXT;
    v_familias_sorted JSONB;
    v_skus_sorted JSONB;
BEGIN
    -- [A] Validação de Parâmetros Básicos
    IF p_planejamento_id IS NULL THEN
        RAISE EXCEPTION 'ID do planejamento é obrigatório.';
    END IF;

    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key é obrigatória para oficialização.';
    END IF;

    -- [B] HIERARQUIA ESTRITA DE LOCKS ADVISORY (Prevenção Total de Deadlock)
    -- LOCK 1 (Nível 1): Lock global pela Idempotency Key (Impede colisão da mesma chave em qualquer entidade)
    PERFORM pg_advisory_xact_lock(hashtext('idempotency_key_' || p_idempotency_key));

    -- LOCK 2 (Nível 2): Lock pelo Planejamento ID (Serializa operações concorrentes no mesmo planejamento)
    PERFORM pg_advisory_xact_lock(hashtext('oficializar_planejamento_' || p_planejamento_id::text));

    -- [C] Validação Soberana de Identidade (auth.uid()) e Tratamento de service_role
    BEGIN
        v_auth_uid := auth.uid();
        v_auth_role := current_setting('request.jwt.claim.role', true);
    EXCEPTION WHEN OTHERS THEN
        v_auth_uid := NULL;
        v_auth_role := NULL;
    END;

    IF v_auth_role = 'authenticated' OR v_auth_uid IS NOT NULL THEN
        -- Contexto de usuário autenticado comum via JWT
        IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: p_user_id divergente do token autenticado auth.uid() [Token: %, Param: %]', 
                v_auth_uid, p_user_id;
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSIF v_auth_role = 'service_role' OR (v_auth_uid IS NULL AND current_user = 'postgres') THEN
        -- Contexto de service_role interno / script de teste administrativo
        v_effective_user_id := p_user_id;
    ELSE
        v_effective_user_id := COALESCE(v_auth_uid, p_user_id);
    END IF;

    IF v_effective_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso Negado: Identidade do usuário não informada.';
    END IF;

    -- [D] Carregar e Validar o Registro do Planejamento
    SELECT * INTO v_plan 
    FROM public.cm_acoes_investimento 
    WHERE id = p_planejamento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Planejamento % não encontrado.', p_planejamento_id;
    END IF;

    IF COALESCE(v_plan.is_planejamento, false) = false THEN
        RAISE EXCEPTION 'O registro % não é um planejamento válido ativo.', p_planejamento_id;
    END IF;

    -- Carregar campanha original do planejamento para obter gerente_id de carteira
    SELECT * INTO v_campanha_origem 
    FROM public.cm_campanhas 
    WHERE id = v_plan.campanha_id;

    -- [E] Validação de Perfil e RBAC de Carteira
    SELECT * INTO v_user_profile 
    FROM public.cm_user_profiles 
    WHERE id = v_effective_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil de usuário % não encontrado em cm_user_profiles.', v_effective_user_id;
    END IF;

    IF COALESCE(v_user_profile.approved, false) = false THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil % não está aprovado.', v_effective_user_id;
    END IF;

    -- Se for Gerente Regional, verificar se o planejamento pertence à sua carteira
    IF v_user_profile.role = 'Gerente Regional' THEN
        IF v_campanha_origem.gerente_id IS NOT NULL AND v_campanha_origem.gerente_id IS DISTINCT FROM v_effective_user_id THEN
            RAISE EXCEPTION 'Acesso Negado: O planejamento % pertence a outro gerente comercial.', p_planejamento_id;
        END IF;
    ELSIF v_user_profile.role NOT IN ('Admin', 'Admin Master', 'Trade', 'CEO', 'Diretor') THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil % não possui permissão para oficializar planejamentos.', v_user_profile.role;
    END IF;

    -- [F] Cálculo Determinístico do Snapshot Hash
    -- Ordenar arrays JSONB deterministicamente para garantir hash idêntico independente da ordem
    SELECT COALESCE(jsonb_agg(elem ORDER BY elem->>'familia_id'), '[]'::jsonb)
    INTO v_familias_sorted
    FROM jsonb_array_elements(COALESCE(v_plan.familias_detalhes, '[]'::jsonb)) AS elem;

    SELECT COALESCE(jsonb_agg(elem ORDER BY elem->>'sku'), '[]'::jsonb)
    INTO v_skus_sorted
    FROM jsonb_array_elements(COALESCE(v_plan.skus_detalhes, '[]'::jsonb)) AS elem;

    v_current_snapshot_hash := md5(
        upper(trim(COALESCE(v_plan.rede, ''))) || '|' ||
        trim(COALESCE(v_plan.codigo_matriz, '')) || '|' ||
        COALESCE(v_plan.mes_referencia, '') || '|' ||
        COALESCE(v_plan.data_inicio::text, '') || '|' ||
        COALESCE(v_plan.data_fim::text, '') || '|' ||
        COALESCE(v_plan.date_mode, 'single') || '|' ||
        COALESCE(v_plan.tipo_acao, '') || '|' ||
        COALESCE(v_plan.tipo_acao_detalhe, 'Ação de Vendas') || '|' ||
        COALESCE(v_plan.abrangencia, 'Família') || '|' ||
        COALESCE(v_plan.tipo_pagamento, 'Transf. Bancária') || '|' ||
        COALESCE(v_plan.valor_investimento::text, '0') || '|' ||
        COALESCE(v_plan.expectativa_volume::text, '0') || '|' ||
        COALESCE(v_plan.preco_flat::text, '0') || '|' ||
        COALESCE(v_plan.preco_acao::text, '0') || '|' ||
        v_familias_sorted::text || '|' ||
        v_skus_sorted::text
    );

    -- [G] Checagem e Resolução de Idempotência
    SELECT * INTO v_existing_audit 
    FROM public.cm_audit_logs 
    WHERE action = 'OFICIALIZAR_PLANEJAMENTO'
      AND (new_data->>'idempotency_key' = p_idempotency_key)
    LIMIT 1;

    IF FOUND THEN
        -- Cenário A: Mesma chave, mesmo planejamento e mesmo snapshot -> IDEMPOTENT SUCCESS
        IF (v_existing_audit.new_data->>'planejamento_id')::uuid = p_planejamento_id 
           AND v_existing_audit.new_data->>'snapshot_hash' = v_current_snapshot_hash THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'campanha_id', v_existing_audit.new_data->>'campanha_id',
                'acao_id', v_existing_audit.new_data->>'acao_oficial_id',
                'planejamento_id', p_planejamento_id,
                'message', 'Oficialização já processada anteriormente para esta intenção (idempotente).'
            );
        END IF;

        -- Cenário C: Mesma chave utilizada para outro planejamento -> CONFLITO DE ENTIDADE
        IF (v_existing_audit.new_data->>'planejamento_id')::uuid <> p_planejamento_id THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT_ENTITY: A chave % já foi utilizada para outro planejamento (%).', 
                p_idempotency_key, v_existing_audit.new_data->>'planejamento_id';
        END IF;

        -- Cenário D: Mesma chave e mesmo planejamento, mas snapshot modificado -> CONFLITO DE PAYLOAD
        IF v_existing_audit.new_data->>'snapshot_hash' <> v_current_snapshot_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT_MUTATED: O conteúdo do planejamento foi modificado após a geração da chave %. Gere uma nova intenção de oficialização.', 
                p_idempotency_key;
        END IF;
    END IF;

    -- [H] Criação Atômica da Campanha Oficial
    INSERT INTO public.cm_campanhas (
        nome_campanha,
        rede,
        codigo_matriz,
        mes_referencia,
        status_operacional,
        status_financeiro,
        gerente_id
    )
    VALUES (
        COALESCE(v_campanha_origem.nome_campanha, 'Campanha ' || v_plan.rede || ' - ' || v_plan.mes_referencia),
        v_plan.rede,
        v_plan.codigo_matriz,
        v_plan.mes_referencia,
        'PLANEJAMENTO',
        'ABERTA',
        COALESCE(v_campanha_origem.gerente_id, v_effective_user_id)
    )
    RETURNING id INTO v_campanha_id;

    -- [I] Criação Atômica da Ação Oficial Homologada (is_planejamento = false, fase_atual = 1)
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
        approved_snapshot
    )
    VALUES (
        v_campanha_id,
        v_plan.rede,
        v_plan.codigo_matriz,
        v_plan.data_inicio,
        v_plan.data_fim,
        COALESCE(v_plan.date_mode, 'single'),
        v_plan.tipo_acao,
        COALESCE(v_plan.tipo_acao_detalhe, 'Ação de Vendas'),
        v_plan.familia_produto,
        COALESCE(v_plan.familias_detalhes, '[]'::jsonb),
        COALESCE(v_plan.preco_flat, 0),
        COALESCE(v_plan.preco_acao, 0),
        COALESCE(v_plan.valor_investimento, 0),
        COALESCE(v_plan.expectativa_volume, 0),
        COALESCE(v_plan.abrangencia, 'Família'),
        v_plan.tipo_pagamento,
        COALESCE(v_plan.skus_detalhes, '[]'::jsonb),
        v_plan.mes_referencia,
        1,
        false, -- -> AÇÃO OFICIAL HOMOLOGADA
        COALESCE(v_plan.alertas_preventivos, '[]'::jsonb),
        'NAO_FATURADA',
        jsonb_build_object(
            'origem_planejamento_id', p_planejamento_id,
            'idempotency_key', p_idempotency_key,
            'snapshot_hash', v_current_snapshot_hash,
            'oficializado_em', now(),
            'oficializado_por', v_effective_user_id
        )
    )
    RETURNING id INTO v_nova_acao_id;

    -- [J] Registro Atômico de Auditoria Forense
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    )
    VALUES (
        'cm_acoes_investimento',
        'OFICIALIZAR_PLANEJAMENTO',
        v_effective_user_id,
        jsonb_build_object(
            'planejamento_id', p_planejamento_id,
            'acao_oficial_id', v_nova_acao_id,
            'campanha_id', v_campanha_id,
            'idempotency_key', p_idempotency_key,
            'snapshot_hash', v_current_snapshot_hash,
            'rede', v_plan.rede,
            'codigo_matriz', v_plan.codigo_matriz,
            'mes_referencia', v_plan.mes_referencia,
            'valor_investimento', v_plan.valor_investimento,
            'expectativa_volume', v_plan.expectativa_volume,
            'oficializado_em', now(),
            'oficializado_por', v_effective_user_id
        )
    );

    -- [K] INVARIANTE SOBERANA: O PLANEJAMENTO ORIGINAL (v_plan.id) NÃO É MODIFICADO!
    -- Permanece com is_planejamento = true intacto.

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'campanha_id', v_campanha_id,
        'acao_id', v_nova_acao_id,
        'planejamento_id', p_planejamento_id
    );
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$$;

-- 4. Configuração de Privilégios e Hardening de Segurança
REVOKE ALL ON FUNCTION public.oficializar_planejamento_v1(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.oficializar_planejamento_v1(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.oficializar_planejamento_v1(UUID, UUID, TEXT) TO authenticated, service_role;
