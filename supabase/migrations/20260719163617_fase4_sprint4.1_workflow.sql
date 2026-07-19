-- Migration: 20260719163617_fase4_sprint4.1_workflow.sql
-- Description: Tabelas, RLS, triggers de integridade e máquina de estados (workflow) para a Fase 4

BEGIN;

-- 1. Criar o Enum de Estados do Workflow
CREATE TYPE public.cm_workflow_status_enum AS ENUM ('RASCUNHO', 'PENDENTE_APROVACAO', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- 2. Tabela de Solicitações de Governança
CREATE TABLE IF NOT EXISTS public.cm_ownership_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_codigo INTEGER NOT NULL REFERENCES public.cm_clientes(codigo),
    uf_proposta TEXT,
    codigo_matriz_proposto TEXT,
    responsavel_proposto TEXT,
    justificativa TEXT NOT NULL,
    status public.cm_workflow_status_enum NOT NULL DEFAULT 'RASCUNHO',
    versao INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.cm_user_profiles(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.cm_user_profiles(id)
);

-- 3. Tabela de Auditoria de Modificações (Enriquecida)
CREATE TABLE IF NOT EXISTS public.cm_audit_ownership_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.cm_ownership_requests(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('CREATE_REQUEST', 'SUBMIT_REQUEST', 'APPROVE', 'REJECT', 'CANCEL', 'CREATE_MATRIX', 'LINK_BRANCH', 'CHANGE_MANAGER', 'CHANGE_UF', 'UPDATE_SETTING')),
    old_value JSONB,
    new_value JSONB,
    justificativa TEXT,
    executed_by UUID REFERENCES public.cm_user_profiles(id),
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar RLS
ALTER TABLE public.cm_ownership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_audit_ownership_log ENABLE ROW LEVEL SECURITY;

-- 5. Criar Políticas RLS
-- 5.1. cm_ownership_requests: todos autenticados leem, criação e atualização pelo próprio autor
CREATE POLICY select_requests ON public.cm_ownership_requests 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY insert_requests ON public.cm_ownership_requests 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY update_requests ON public.cm_ownership_requests 
    FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.is_governance_admin(auth.uid()));

-- 5.2. cm_audit_ownership_log: todos autenticados leem, escrita apenas interna
CREATE POLICY select_logs ON public.cm_audit_ownership_log 
    FOR SELECT TO authenticated USING (true);

-- 6. Trigger para Bloquear Alteração Direta do Campo status
CREATE OR REPLACE FUNCTION public.check_ownership_request_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Bloqueia a alteração a menos que a flag de bypass esteja setada na sessão
        IF current_setting('app.workflow_bypass', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Alteração direta do status da solicitação não permitida. Utilize a função transition_ownership_request.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_check_ownership_request_status_change
BEFORE UPDATE ON public.cm_ownership_requests
FOR EACH ROW EXECUTE FUNCTION public.check_ownership_request_status_change();

-- 7. Função Centralizada de Workflow de Transição de Estados
CREATE OR REPLACE FUNCTION public.transition_ownership_request(
    p_request_id UUID,
    p_next_status TEXT,
    p_notes TEXT,
    p_actor_id UUID
) RETURNS void AS $$
DECLARE
    v_current_status TEXT;
    v_cliente_codigo INTEGER;
    v_uf TEXT;
    v_matriz TEXT;
    v_responsavel TEXT;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- 1. Obter dados da solicitação
    SELECT status::text, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto
    INTO v_current_status, v_cliente_codigo, v_uf, v_matriz, v_responsavel
    FROM public.cm_ownership_requests
    WHERE id = p_request_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação não encontrada.';
    END IF;

    -- 2. Validar Máquina de Estados de Transições
    IF v_current_status = 'RASCUNHO' AND p_next_status NOT IN ('PENDENTE_APROVACAO', 'CANCELADO') THEN
        RAISE EXCEPTION 'Transição inválida de RASCUNHO para %.', p_next_status;
    ELSIF v_current_status = 'PENDENTE_APROVACAO' AND p_next_status NOT IN ('APROVADO', 'REJEITADO', 'CANCELADO') THEN
        RAISE EXCEPTION 'Transição inválida de PENDENTE_APROVACAO para %.', p_next_status;
    ELSIF v_current_status IN ('APROVADO', 'REJEITADO', 'CANCELADO') THEN
        RAISE EXCEPTION 'Solicitação finalizada em estado % não pode mais sofrer transição.', v_current_status;
    END IF;

    -- 3. Habilitar Bypass Temporário para Atualização do Status
    PERFORM set_config('app.workflow_bypass', 'true', true);

    -- 4. Se APROVADO, aplicar fisicamente na cm_clientes
    IF p_next_status = 'APROVADO' THEN
        -- Backup dos valores cadastrais anteriores
        SELECT jsonb_build_object('uf', uf, 'codigo_matriz', codigo_matriz, 'responsavel', responsavel)
        INTO v_old_values
        FROM public.cm_clientes
        WHERE codigo = v_cliente_codigo;
        
        -- Atualização física controlada
        UPDATE public.cm_clientes
        SET uf = COALESCE(v_uf, uf),
            codigo_matriz = COALESCE(v_matriz, codigo_matriz),
            responsavel = COALESCE(v_responsavel, responsavel)
        WHERE codigo = v_cliente_codigo;

        v_new_values := jsonb_build_object('uf', v_uf, 'codigo_matriz', v_matriz, 'responsavel', v_responsavel);

        -- Gravar log de auditoria
        INSERT INTO public.cm_audit_ownership_log (request_id, action_type, old_value, new_value, justificativa, executed_by)
        VALUES (p_request_id, 'APPROVE', v_old_values, v_new_values, p_notes, p_actor_id);

    ELSIF p_next_status = 'REJEITADO' THEN
        INSERT INTO public.cm_audit_ownership_log (request_id, action_type, old_value, new_value, justificativa, executed_by)
        VALUES (p_request_id, 'REJECT', NULL, NULL, p_notes, p_actor_id);
    ELSIF p_next_status = 'CANCELADO' THEN
        INSERT INTO public.cm_audit_ownership_log (request_id, action_type, old_value, new_value, justificativa, executed_by)
        VALUES (p_request_id, 'CANCEL', NULL, NULL, p_notes, p_actor_id);
    ELSIF p_next_status = 'PENDENTE_APROVACAO' THEN
        INSERT INTO public.cm_audit_ownership_log (request_id, action_type, old_value, new_value, justificativa, executed_by)
        VALUES (p_request_id, 'SUBMIT_REQUEST', NULL, NULL, p_notes, p_actor_id);
    END IF;

    -- 5. Incrementar Versão e Atualizar Status
    UPDATE public.cm_ownership_requests
    SET status = p_next_status::public.cm_workflow_status_enum,
        versao = versao + 1,
        updated_at = NOW(),
        updated_by = p_actor_id
    WHERE id = p_request_id;

    -- 6. Desativar Bypass
    PERFORM set_config('app.workflow_bypass', 'false', true);
END;
$$ LANGUAGE plpgsql;

-- 8. Registrar Metadados
INSERT INTO public.cm_governance_schema_history (baseline_version, fase, sprint, migration_name)
VALUES ('v1.0.1', 'Fase 4', 'Sprint 4.1', '20260719163617_fase4_sprint4.1_workflow.sql');

COMMIT;
