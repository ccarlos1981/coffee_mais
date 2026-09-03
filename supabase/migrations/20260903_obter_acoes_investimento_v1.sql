-- Migration: 20260903_obter_acoes_investimento_v1.sql
-- Description: RPC de Leitura Segura de Ações de Investimento com Isolamento Canônico de Gerente Regional
-- Baseline: BASELINE_INVESTIMENTOS_20260901_LOCKED

CREATE OR REPLACE FUNCTION public.obter_acoes_investimento_v1(
    p_is_planejamento BOOLEAN DEFAULT false,
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
    v_user_email TEXT;
    v_user_name_clean TEXT;
    v_mgr_name_clean TEXT;
    v_email_prefix TEXT;
    v_result JSONB;
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

    -- [B] Validação do Perfil
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

    -- [C] Consulta Segura Baseada na Role
    IF v_user_profile.role = 'Gerente Regional' THEN
        v_user_name_clean := UPPER(REGEXP_REPLACE(COALESCE(v_user_profile.name, ''), '[^a-zA-Z0-9]', '', 'g'));
        v_mgr_name_clean := UPPER(REGEXP_REPLACE(COALESCE(v_user_profile.manager_name, ''), '[^a-zA-Z0-9]', '', 'g'));
        v_email_prefix := UPPER(REGEXP_REPLACE(SPLIT_PART(COALESCE(v_user_email, ''), '@', 1), '[^a-zA-Z0-9]', '', 'g'));

        SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC) INTO v_result
        FROM public.v_acoes_investimento_com_gerente v
        LEFT JOIN public.cm_campanhas c ON c.id = v.campanha_id
        WHERE v.is_planejamento = p_is_planejamento
          AND (
              -- 1. Chave Canônica Primária: Campanha criada/gerenciada pelo próprio usuário
              c.gerente_id = v_effective_user_id
              OR
              -- 2. Fallbacks para registros legados/sem vínculo direto de gerente_id na campanha
              (
                  (c.gerente_id IS NULL OR c.gerente_id NOT IN (SELECT id FROM public.cm_user_profiles WHERE role = 'Gerente Regional'))
                  AND v.gerente_responsavel IS NOT NULL
                  AND (
                      (v_user_name_clean <> '' AND (UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) LIKE v_user_name_clean || '%' OR v_user_name_clean LIKE UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) || '%'))
                      OR (v_mgr_name_clean <> '' AND (UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) LIKE v_mgr_name_clean || '%' OR v_mgr_name_clean LIKE UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) || '%'))
                      OR (v_email_prefix <> '' AND (UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) LIKE v_email_prefix || '%' OR v_email_prefix LIKE UPPER(REGEXP_REPLACE(v.gerente_responsavel, '[^a-zA-Z0-9]', '', 'g')) || '%'))
                  )
              )
          );
    ELSE
        -- Demais perfis autorizados (Trade, Supervisor, Diretor, Financeiro, Admin, Admin Master, CEO)
        SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC) INTO v_result
        FROM public.v_acoes_investimento_com_gerente v
        WHERE v.is_planejamento = p_is_planejamento;
    END IF;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.obter_acoes_investimento_v1(BOOLEAN, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_acoes_investimento_v1(BOOLEAN, UUID) TO authenticated, service_role;
