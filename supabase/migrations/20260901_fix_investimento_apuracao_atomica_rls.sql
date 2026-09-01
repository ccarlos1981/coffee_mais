-- ==============================================================================
-- COFFEE++ — CORREÇÃO CIRÚRGICA: APURAÇÃO ATÔMICA E RLS DE VÍNCULO DE BOLETOS
-- Data: 2026-09-01
-- Descrição:
--   1. Corrige a policy RLS em cm_acoes_boletos_vinculo para autorizar 'Gerente Regional',
--      'Supervisor' e 'Diretor' no escopo comercial aprovado.
--   2. Cria a RPC atômica e transacional 'concluir_apuracao_investimento' com
--      rollback automático total, validação de integridade e idempotência.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ATUALIZAÇÃO DA POLICY RLS EM cm_acoes_boletos_vinculo
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "cm_acoes_boletos_vinculo_manage_auth" ON public.cm_acoes_boletos_vinculo;

CREATE POLICY "cm_acoes_boletos_vinculo_manage_auth"
ON public.cm_acoes_boletos_vinculo FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT cm_user_profiles.id
    FROM cm_user_profiles
    WHERE cm_user_profiles.approved = true
      AND cm_user_profiles.role = ANY (ARRAY[
        'Admin'::text,
        'Admin Master'::text,
        'CEO'::text,
        'Trade'::text,
        'Financeiro'::text,
        'Gerente Regional'::text,
        'Supervisor'::text,
        'Diretor'::text
      ])
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT cm_user_profiles.id
    FROM cm_user_profiles
    WHERE cm_user_profiles.approved = true
      AND cm_user_profiles.role = ANY (ARRAY[
        'Admin'::text,
        'Admin Master'::text,
        'CEO'::text,
        'Trade'::text,
        'Financeiro'::text,
        'Gerente Regional'::text,
        'Supervisor'::text,
        'Diretor'::text
      ])
  )
);


-- ------------------------------------------------------------------------------
-- 2. RPC ATÔMICA TRANSACIONAL: concluir_apuracao_investimento
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.concluir_apuracao_investimento(
    p_acao_id UUID,
    p_apuracao_numero_acordo TEXT,
    p_apuracao_qtd_vendida INTEGER DEFAULT NULL,
    p_apuracao_valor_realizado NUMERIC DEFAULT NULL,
    p_apuracao_evidencias_url TEXT DEFAULT NULL,
    p_condicao_pagamento TEXT DEFAULT NULL,
    p_sem_boleto BOOLEAN DEFAULT FALSE,
    p_post_action_notes TEXT DEFAULT NULL,
    p_vinculos JSONB DEFAULT '[]'::jsonb,
    p_user_email TEXT DEFAULT 'unknown',
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_acao public.cm_acoes_investimento%ROWTYPE;
    v_item jsonb;
    v_boleto_id uuid;
    v_valor_associado numeric;
    v_primeiro_boleto_id uuid := NULL;
    v_total_vinculos integer := 0;
BEGIN
    -- 1. Validação de obrigatoriedade do identificador do acordo
    IF p_apuracao_numero_acordo IS NULL OR TRIM(p_apuracao_numero_acordo) = '' THEN
        RAISE EXCEPTION 'Dados do Acordo é obrigatório.';
    END IF;

    -- 2. Buscar e travar a ação para atualização atômica (SELECT FOR UPDATE)
    SELECT * INTO v_acao
    FROM public.cm_acoes_investimento
    WHERE id = p_acao_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ação de investimento % não encontrada.', p_acao_id;
    END IF;

    -- 3. Validação de fase e idempotência
    IF v_acao.fase_atual = 4 THEN
        -- Idempotência: Se já estiver na fase 4, atualizar os dados de apuração e vínculos sem quebrar
        NULL;
    ELSIF v_acao.fase_atual <> 3 THEN
        RAISE EXCEPTION 'Ação % não está na fase de Apuração (Fase 3). Fase atual: %', p_acao_id, v_acao.fase_atual;
    END IF;

    -- 4. Validação de vínculos de boletos quando informados
    IF p_vinculos IS NOT NULL AND jsonb_typeof(p_vinculos) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_vinculos) LOOP
            v_boleto_id := (v_item->>'boleto_id')::uuid;
            v_valor_associado := COALESCE((v_item->>'valor_associado')::numeric, 0);

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

    -- 5. Atualizar a ação em cm_acoes_investimento para Fase 4
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

    -- 6. Limpar vínculos de boletos anteriores para garantir idempotência
    DELETE FROM public.cm_acoes_boletos_vinculo
    WHERE acao_id = p_acao_id;

    -- 7. Inserir novos vínculos de boletos
    IF p_vinculos IS NOT NULL AND jsonb_typeof(p_vinculos) = 'array' AND jsonb_array_length(p_vinculos) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_vinculos) LOOP
            v_boleto_id := (v_item->>'boleto_id')::uuid;
            v_valor_associado := COALESCE((v_item->>'valor_associado')::numeric, 0);

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

    -- 8. Registro em audit log oficial (action = 'UPDATE')
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_acoes_investimento',
        'UPDATE',
        p_user_id,
        jsonb_build_object(
            'acao_id', p_acao_id,
            'operacao', 'CONCLUIR_APURACAO',
            'fase_anterior', v_acao.fase_atual,
            'fase_destino', 4,
            'apuracao_numero_acordo', TRIM(p_apuracao_numero_acordo),
            'apuracao_qtd_vendida', p_apuracao_qtd_vendida,
            'apuracao_valor_realizado', p_apuracao_valor_realizado,
            'total_boletos_vinculados', v_total_vinculos,
            'sem_boleto', COALESCE(p_sem_boleto, FALSE),
            'preenchido_por', p_user_email,
            'timestamp', NOW()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'action_id', p_acao_id,
        'fase_atual', 4,
        'primeiro_boleto_id', v_primeiro_boleto_id,
        'total_boletos_vinculados', v_total_vinculos
    );
END;
$$;

COMMIT;
