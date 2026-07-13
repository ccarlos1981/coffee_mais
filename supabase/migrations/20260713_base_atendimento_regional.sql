-- 1. Criar a tabela cm_base_atendimento_regional
CREATE TABLE IF NOT EXISTS public.cm_base_atendimento_regional (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_matriz_id TEXT NOT NULL REFERENCES public.cm_redes_matrizes(codigo) ON DELETE CASCADE,
    estado VARCHAR(2) NOT NULL,
    regional TEXT NOT NULL,
    gerente_responsavel_id UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    supervisor_responsavel_id UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    distribuidor_responsavel_id UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT cm_base_atendimento_regional_unique UNIQUE (cliente_matriz_id, estado)
);

-- 2. Habilitar RLS e criar política de acesso total para usuários autenticados
ALTER TABLE public.cm_base_atendimento_regional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users full access on regional mapping" ON public.cm_base_atendimento_regional;
CREATE POLICY "Allow all authenticated users full access on regional mapping" 
ON public.cm_base_atendimento_regional 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Criar índice otimizado para consultas por (cliente_matriz_id, estado, ativo)
CREATE INDEX IF NOT EXISTS idx_cm_base_atendimento_regional_lookup 
ON public.cm_base_atendimento_regional(cliente_matriz_id, estado, ativo);

-- 4. Popular os dados iniciais cruzando cm_clientes e cm_user_profiles
INSERT INTO public.cm_base_atendimento_regional (cliente_matriz_id, estado, regional, gerente_responsavel_id, ativo)
SELECT DISTINCT ON (c.codigo_matriz, c.uf)
    c.codigo_matriz,
    c.uf,
    COALESCE(c.regional, 'Regional'),
    (
        SELECT u.id 
        FROM public.cm_user_profiles u 
        WHERE (u.name ILIKE c.responsavel || '%' OR c.responsavel ILIKE u.name || '%') 
          AND u.role = 'Gerente Regional'
        LIMIT 1
    ) as gerente_id,
    true
FROM public.cm_clientes c
WHERE c.codigo_matriz IS NOT NULL 
  AND c.uf IS NOT NULL 
  AND c.responsavel IS NOT NULL
ON CONFLICT (cliente_matriz_id, estado) DO NOTHING;

-- 5. Trigger em cm_clientes: recalcula o responsável baseado na regional antes de inserir ou atualizar
CREATE OR REPLACE FUNCTION public.fn_sync_cm_clientes_responsavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gerente_id UUID;
    v_gerente_name TEXT;
    v_default_manager TEXT;
BEGIN
    IF NEW.codigo_matriz IS NOT NULL AND NEW.uf IS NOT NULL THEN
        -- Tentar buscar da tabela regional
        SELECT gerente_responsavel_id INTO v_gerente_id
        FROM public.cm_base_atendimento_regional
        WHERE cliente_matriz_id = NEW.codigo_matriz AND estado = NEW.uf AND ativo = true
        LIMIT 1;

        IF v_gerente_id IS NOT NULL THEN
            SELECT name INTO v_gerente_name
            FROM public.cm_user_profiles
            WHERE id = v_gerente_id;
            
            IF v_gerente_name IS NOT NULL THEN
                NEW.responsavel := v_gerente_name;
                RETURN NEW;
            END IF;
        END IF;

        -- Fallback para manager_uf_mapping
        SELECT manager INTO v_default_manager
        FROM public.manager_uf_mapping
        WHERE uf = NEW.uf
        LIMIT 1;

        IF v_default_manager IS NOT NULL THEN
            NEW.responsavel := v_default_manager;
        ELSE
            -- Fallback geral se nulo
            IF NEW.responsavel IS NULL THEN
                NEW.responsavel := 'Inside Sales';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cm_clientes_responsavel ON public.cm_clientes;
CREATE TRIGGER trg_sync_cm_clientes_responsavel
BEFORE INSERT OR UPDATE OF codigo_matriz, uf ON public.cm_clientes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_cm_clientes_responsavel();

-- 6. Trigger em cm_base_atendimento_regional: propaga alterações de gerente para os clientes correspondentes
CREATE OR REPLACE FUNCTION public.fn_propagate_regional_manager_to_clientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gerente_name TEXT;
BEGIN
    IF NEW.ativo = true AND NEW.gerente_responsavel_id IS NOT NULL THEN
        SELECT name INTO v_gerente_name
        FROM public.cm_user_profiles
        WHERE id = NEW.gerente_responsavel_id;
    END IF;

    IF v_gerente_name IS NULL THEN
        -- Se inativo ou sem gerente, usar o fallback padrão
        UPDATE public.cm_clientes
        SET responsavel = COALESCE(
            (SELECT manager FROM public.manager_uf_mapping WHERE uf = NEW.estado LIMIT 1),
            'Inside Sales'
        )
        WHERE codigo_matriz = NEW.cliente_matriz_id AND uf = NEW.estado;
    ELSE
        UPDATE public.cm_clientes
        SET responsavel = v_gerente_name
        WHERE codigo_matriz = NEW.cliente_matriz_id AND uf = NEW.estado;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_regional_manager_to_clientes ON public.cm_base_atendimento_regional;
CREATE TRIGGER trg_propagate_regional_manager_to_clientes
AFTER INSERT OR UPDATE OF gerente_responsavel_id, ativo ON public.cm_base_atendimento_regional
FOR EACH ROW
EXECUTE FUNCTION public.fn_propagate_regional_manager_to_clientes();

-- 7. Atualizar a RPC criar_campanha_e_acoes_v2 para aceitar e inserir gerente_id
CREATE OR REPLACE FUNCTION public.criar_campanha_e_acoes_v2(p_campanha jsonb, p_acoes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_campanha_id UUID := NULL;
    v_acao jsonb;
BEGIN
    -- 1. Sempre criar a campanha caso os dados de campanha sejam fornecidos
    IF p_campanha IS NOT NULL THEN
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
            p_campanha->>'nome_campanha',
            p_campanha->>'rede',
            p_campanha->>'codigo_matriz',
            p_campanha->>'mes_referencia',
            COALESCE(p_campanha->>'status_operacional', 'PLANEJAMENTO'),
            COALESCE(p_campanha->>'status_financeiro', 'ABERTA'),
            (p_campanha->>'gerente_id')::uuid
        )
        RETURNING id INTO v_campanha_id;
    END IF;

    -- 2. Inserir cada ação do array jsonb vinculada à campanha
    FOR v_acao IN SELECT * FROM jsonb_array_elements(p_acoes) LOOP
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
            status_financeiro
        )
        VALUES (
            v_campanha_id,
            v_acao->>'rede',
            v_acao->>'codigo_matriz',
            (v_acao->>'data_inicio')::date,
            (v_acao->>'data_fim')::date,
            COALESCE(v_acao->>'date_mode', 'single'),
            v_acao->>'tipo_acao',
            COALESCE(v_acao->>'tipo_acao_detalhe', 'Ação de Vendas'),
            v_acao->>'familia_produto',
            COALESCE((v_acao->'familias_detalhes'), '[]'::jsonb),
            COALESCE((v_acao->>'preco_flat')::numeric, 0),
            COALESCE((v_acao->>'preco_acao')::numeric, 0),
            COALESCE((v_acao->>'valor_investimento')::numeric, 0),
            COALESCE((v_acao->>'expectativa_volume')::numeric, 0),
            COALESCE(v_acao->>'abrangencia', 'Família'),
            v_acao->>'tipo_pagamento',
            COALESCE((v_acao->'skus_detalhes'), '[]'::jsonb),
            v_acao->>'mes_referencia',
            COALESCE((v_acao->>'fase_atual')::integer, 1),
            COALESCE((v_acao->>'is_planejamento')::boolean, false),
            COALESCE((v_acao->'alertas_preventivos'), '[]'::jsonb),
            COALESCE(v_acao->>'status_financeiro', 'NAO_FATURADA')
        );
    END LOOP;

    RETURN jsonb_build_object('success', true, 'campanha_id', v_campanha_id);
EXCEPTION WHEN OTHERS THEN
    RAISE;
END;
$function$;

-- 8. Recriar a view v_acoes_investimento_com_gerente incorporando priorização de gerente de campanha
DROP VIEW IF EXISTS public.v_acoes_investimento_com_gerente CASCADE;
CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
 WITH manager_mapping AS (
         SELECT DISTINCT ON (cm_clientes.codigo_matriz, (upper(cm_clientes.matriz))) cm_clientes.codigo_matriz,
            upper(cm_clientes.matriz) AS clean_rede,
            cm_clientes.responsavel AS manager
           FROM cm_clientes
          WHERE ((cm_clientes.codigo_matriz IS NOT NULL) AND (cm_clientes.responsavel IS NOT NULL))
        ), manager_by_rede AS (
         SELECT DISTINCT ON ((upper(cm_clientes.matriz))) upper(cm_clientes.matriz) AS clean_rede,
            cm_clientes.responsavel AS manager
           FROM cm_clientes
          WHERE ((cm_clientes.matriz IS NOT NULL) AND (cm_clientes.responsavel IS NOT NULL))
        )
 SELECT a.id,
    a.data_registro,
    a.rede,
    a.data_inicio,
    a.data_fim,
    a.tipo_acao,
    a.tipo_acao_detalhe,
    a.familia_produto,
    a.valor_investimento,
    a.created_at,
    a.updated_at,
    a.documento_url,
    a.codigo,
    a.preco_consumidor,
    a.expectativa_volume,
    a.abrangencia,
    a.skus_detalhes,
    a.tipo_pagamento,
    a.preco_flat,
    a.preco_acao,
    a.fase_atual,
    a.trade_validado_em,
    a.trade_validado_por,
    a.numero_acordo,
    a.evidencias_urls,
    a.volume_vendido_sellout,
    a.vencimento,
    a.dados_quitacao,
    a.apuracao_preenchida_em,
    a.apuracao_preenchida_por,
    a.trade_conferido_em,
    a.trade_conferido_por,
    a.trade_conferencia_aprovado,
    a.trade_conferencia_observacao,
    a.financeiro_pago_em,
    a.financeiro_pago_por,
    a.financeiro_comprovante_url,
    a.financeiro_observacoes,
    a.checklist_comunicacao,
    a.checklist_logistica,
    a.checklist_auditoria,
    a.checklist_garantia,
    a.apuracao_numero_acordo,
    a.apuracao_qtd_vendida,
    a.apuracao_valor_realizado,
    a.apuracao_evidencias_url,
    a.apuracao_boleto_id,
    a.checklist_conferencia,
    a.mes_referencia,
    a.codigo_matriz,
    a.is_planejamento,
    a.financeiro_boleto_url,
    a.sem_boleto,
    a.familias_detalhes,
    a.approved_snapshot,
    a.approved_by,
    a.approved_at,
    a.real_volume,
    a.real_faturamento,
    a.real_margem,
    a.roi,
    a.alertas_preventivos,
    a.is_reopened,
    a.reopened_by,
    a.reopened_at,
    a.reopened_reason,
    a.approval_comment,
    a.rejection_reason,
    a.cancel_reason,
    a.roi_mode,
    a.approved_alerts_snapshot,
    a.action_result,
    a.post_action_notes,
    a.execution_score,
    a.date_mode,
    a.import_batch_id,
    COALESCE(a.condicao_pagamento, ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE (cm_clientes.codigo_matriz = a.codigo_matriz)
         LIMIT 1), ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE (upper(cm_clientes.matriz) = upper(a.rede))
         LIMIT 1)) AS condicao_pagamento,
    COALESCE(
        (SELECT up.name FROM public.cm_user_profiles up WHERE up.id = c.gerente_id),
        ( SELECT mm.manager
           FROM manager_mapping mm
          WHERE ((mm.codigo_matriz = a.codigo_matriz) AND (mm.clean_rede = upper(a.rede)))
         LIMIT 1), 
        ( SELECT mbr.manager
           FROM manager_by_rede mbr
          WHERE (mbr.clean_rede = upper(a.rede))
         LIMIT 1)
    ) AS gerente_responsavel,
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha,
    a.devolvido_por,
    a.devolvido_em
   FROM (cm_acoes_investimento a
     LEFT JOIN cm_campanhas c ON ((a.campanha_id = c.id)));
