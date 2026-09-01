-- ==============================================================================
-- COFFEE++ — MÚLTIPLAS AÇÕES COMERCIAIS & PLANO FINANCEIRO COM PAGAMENTOS N:N
-- Migration: 20260901_multiplas_acoes_plano_financeiro.sql
-- Baseline de Referência: BASELINE_INVESTIMENTOS_20260901_LOCKED
-- ==============================================================================

-- 1. ATUALIZAÇÃO DA CONSTRAINT DE AUDIT ACTIONS EM cm_audit_logs
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
    'OFICIALIZAR_PLANEJAMENTO'::text,
    'OFICIALIZAR_PLANEJAMENTO_V2'::text,
    'CRIAR_NEGOCIACAO_COMPLETA'::text,
    'CRIAR_PLANO_FINANCEIRO'::text,
    'ALTERAR_PLANO_FINANCEIRO'::text,
    'REGISTRAR_PAGAMENTO'::text,
    'ALOCAR_PAGAMENTO_PARCELA'::text,
    'RECALCULAR_SALDO_PARCELAS'::text,
    'REVISAR_PLANO_VALOR_ACAO'::text,
    'CANCELAR_PARCELAS_QUITACAO'::text,
    'QUITAR_NEGOCIACAO'::text
  ]));

-- 2. EXTENSÕES EM cm_campanhas
ALTER TABLE public.cm_campanhas
  ADD COLUMN IF NOT EXISTS valor_total_projetado NUMERIC(14,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS saldo_financeiro_devedor NUMERIC(14,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS tipo_plano_financeiro TEXT DEFAULT 'A_VISTA';

-- 3. EXTENSÕES EM cm_acoes_investimento
ALTER TABLE public.cm_acoes_investimento
  ADD COLUMN IF NOT EXISTS acao_origem_recorrencia_id UUID REFERENCES public.cm_acoes_investimento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_materializada_futura BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cm_acoes_recorrencia_origem ON public.cm_acoes_investimento(acao_origem_recorrencia_id);
CREATE INDEX IF NOT EXISTS idx_cm_acoes_materializada_futura ON public.cm_acoes_investimento(is_materializada_futura);

-- 4. TABELA cm_investimento_parcelas
CREATE TABLE IF NOT EXISTS public.cm_investimento_parcelas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campanha_id UUID NOT NULL REFERENCES public.cm_campanhas(id) ON DELETE RESTRICT,
    numero_parcela INTEGER NOT NULL,
    total_parcelas INTEGER NOT NULL,
    valor_previsto_original NUMERIC(14,2) NOT NULL,
    valor_previsto NUMERIC(14,2) NOT NULL,
    valor_pago_acumulado NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    saldo_remanescente NUMERIC(14,2) NOT NULL,
    data_vencimento DATE NOT NULL,
    status_parcela TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status_parcela IN ('PENDENTE', 'PARCIALMENTE_PAGA', 'QUITADA', 'CANCELADA_QUITACAO_ANTECIPADA', 'CANCELADA_RENEGOCIACAO')),
    tipo_pagamento TEXT NOT NULL DEFAULT 'Transf. Bancária',
    is_planejamento BOOLEAN NOT NULL DEFAULT false,
    observacoes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_cm_parcela_num CHECK (numero_parcela >= 1 AND numero_parcela <= total_parcelas),
    CONSTRAINT chk_cm_parcela_val CHECK (valor_previsto_original > 0 AND valor_previsto >= 0 AND valor_pago_acumulado >= 0 AND saldo_remanescente >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cm_parcelas_campanha ON public.cm_investimento_parcelas(campanha_id);
CREATE INDEX IF NOT EXISTS idx_cm_parcelas_status ON public.cm_investimento_parcelas(status_parcela);
CREATE INDEX IF NOT EXISTS idx_cm_parcelas_vencimento ON public.cm_investimento_parcelas(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cm_parcelas_planejamento ON public.cm_investimento_parcelas(is_planejamento);

-- 5. TABELA cm_investimento_pagamentos
CREATE TABLE IF NOT EXISTS public.cm_investimento_pagamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campanha_id UUID NOT NULL REFERENCES public.cm_campanhas(id) ON DELETE RESTRICT,
    valor_pago NUMERIC(14,2) NOT NULL CHECK (valor_pago > 0),
    data_pagamento DATE NOT NULL,
    comprovante_url TEXT,
    observacoes TEXT,
    registrado_por UUID REFERENCES public.cm_user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cm_pagamentos_campanha ON public.cm_investimento_pagamentos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_cm_pagamentos_data ON public.cm_investimento_pagamentos(data_pagamento);

-- 6. TABELA cm_investimento_pagamento_alocacoes
CREATE TABLE IF NOT EXISTS public.cm_investimento_pagamento_alocacoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pagamento_id UUID NOT NULL REFERENCES public.cm_investimento_pagamentos(id) ON DELETE CASCADE,
    parcela_id UUID NOT NULL REFERENCES public.cm_investimento_parcelas(id) ON DELETE RESTRICT,
    valor_alocado NUMERIC(14,2) NOT NULL CHECK (valor_alocado > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_cm_pagamento_parcela UNIQUE (pagamento_id, parcela_id)
);

CREATE INDEX IF NOT EXISTS idx_cm_alocacoes_parcela ON public.cm_investimento_pagamento_alocacoes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_cm_alocacoes_pagamento ON public.cm_investimento_pagamento_alocacoes(pagamento_id);

-- 7. CONFIGURAÇÃO DE RLS
ALTER TABLE public.cm_investimento_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_investimento_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_investimento_pagamento_alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_parcelas_select_auth" ON public.cm_investimento_parcelas;
CREATE POLICY "cm_parcelas_select_auth" ON public.cm_investimento_parcelas
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cm_parcelas_manage_auth" ON public.cm_investimento_parcelas;
CREATE POLICY "cm_parcelas_manage_auth" ON public.cm_investimento_parcelas
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles 
    WHERE approved = true AND role IN ('Admin', 'Admin Master', 'CEO', 'Diretor', 'Financeiro', 'Gerente Regional', 'Trade')
  )
);

DROP POLICY IF EXISTS "cm_pagamentos_select_auth" ON public.cm_investimento_pagamentos;
CREATE POLICY "cm_pagamentos_select_auth" ON public.cm_investimento_pagamentos
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cm_pagamentos_manage_auth" ON public.cm_investimento_pagamentos;
CREATE POLICY "cm_pagamentos_manage_auth" ON public.cm_investimento_pagamentos
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles 
    WHERE approved = true AND role IN ('Admin', 'Admin Master', 'CEO', 'Diretor', 'Financeiro')
  )
);

DROP POLICY IF EXISTS "cm_alocacoes_select_auth" ON public.cm_investimento_pagamento_alocacoes;
CREATE POLICY "cm_alocacoes_select_auth" ON public.cm_investimento_pagamento_alocacoes
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "cm_alocacoes_manage_auth" ON public.cm_investimento_pagamento_alocacoes;
CREATE POLICY "cm_alocacoes_manage_auth" ON public.cm_investimento_pagamento_alocacoes
FOR ALL TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM public.cm_user_profiles 
    WHERE approved = true AND role IN ('Admin', 'Admin Master', 'CEO', 'Diretor', 'Financeiro')
  )
);

-- 8. RPC: criar_negociacao_completa_v1
CREATE OR REPLACE FUNCTION public.criar_negociacao_completa_v1(
    p_campanha JSONB,
    p_acoes JSONB,
    p_parcelas JSONB,
    p_user_id UUID,
    p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campanha_id UUID;
    v_total_acoes NUMERIC(14,2) := 0.00;
    v_total_parcelas NUMERIC(14,2) := 0.00;
    v_acao JSONB;
    v_parc JSONB;
    v_rede TEXT;
    v_codigo_matriz TEXT;
    v_mes_referencia TEXT;
    v_gerente_id UUID;
    v_is_planejamento BOOLEAN := false;
    v_existing_audit RECORD;
    v_acao_id UUID;
    v_count_acoes INTEGER := 0;
    v_count_parcelas INTEGER := 0;
BEGIN
    -- [A] Validação de Idempotência
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('negociacao_create_' || p_idempotency_key));

        SELECT * INTO v_existing_audit
        FROM public.cm_audit_logs
        WHERE action = 'CRIAR_NEGOCIACAO_COMPLETA'
          AND (new_data->>'idempotency_key' = p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'campanha_id', v_existing_audit.new_data->>'campanha_id',
                'message', 'Negociação já criada anteriormente (idempotente).'
            );
        END IF;
    END IF;

    -- [B] Extração e Validação dos Dados da Campanha
    v_rede := TRIM(COALESCE(p_campanha->>'rede', ''));
    v_codigo_matriz := NULLIF(TRIM(COALESCE(p_campanha->>'codigo_matriz', '')), '');
    v_mes_referencia := TRIM(COALESCE(p_campanha->>'mes_referencia', ''));
    v_gerente_id := (p_campanha->>'gerente_id')::uuid;
    v_is_planejamento := COALESCE((p_campanha->>'is_planejamento')::boolean, false);

    IF v_rede = '' OR v_mes_referencia = '' THEN
        RAISE EXCEPTION 'Rede e Mês de Referência são obrigatórios para a negociação.';
    END IF;

    -- [C] Cálculo e Validação da Soma das Ações
    IF p_acoes IS NULL OR jsonb_array_length(p_acoes) = 0 THEN
        RAISE EXCEPTION 'Ao menos uma ação comercial deve ser informada.';
    END IF;

    FOR v_acao IN SELECT * FROM jsonb_array_elements(p_acoes) LOOP
        -- Garantir mesma rede em todas as ações
        IF TRIM(COALESCE(v_acao->>'rede', '')) <> v_rede THEN
            RAISE EXCEPTION 'Violação de Integridade: Todas as ações devem pertencer à mesma rede (%).', v_rede;
        END IF;
        v_total_acoes := v_total_acoes + COALESCE((v_acao->>'valor_investimento')::numeric, 0.00);
        v_count_acoes := v_count_acoes + 1;
    END LOOP;

    -- [D] Cálculo e Validação da Soma das Parcelas
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
            v_total_parcelas := v_total_parcelas + COALESCE((v_parc->>'valor_previsto')::numeric, 0.00);
            v_count_parcelas := v_count_parcelas + 1;
        END LOOP;

        -- Paridade estrita de centavos
        IF ABS(v_total_acoes - v_total_parcelas) > 0.01 THEN
            RAISE EXCEPTION 'INCONSISTENCIA_FINANCEIRA: Soma das parcelas (R$ %) diverge do total das ações comerciais (R$ %). Diferença: R$ %',
                v_total_parcelas, v_total_acoes, (v_total_acoes - v_total_parcelas);
        END IF;
    ELSE
        -- Fallback: Se não forneceu grade de parcelas, gerar 1 parcela à vista no valor total
        v_total_parcelas := v_total_acoes;
    END IF;

    -- [E] Inserção da Campanha Master
    INSERT INTO public.cm_campanhas (
        nome_campanha,
        rede,
        codigo_matriz,
        mes_referencia,
        status_operacional,
        status_financeiro,
        gerente_id,
        valor_total_projetado,
        saldo_financeiro_devedor,
        tipo_plano_financeiro
    ) VALUES (
        COALESCE(p_campanha->>'nome_campanha', 'Campanha ' || v_rede || ' - ' || v_mes_referencia),
        v_rede,
        v_codigo_matriz,
        v_mes_referencia,
        COALESCE(p_campanha->>'status_operacional', 'PLANEJAMENTO'),
        'ABERTA',
        v_gerente_id,
        v_total_acoes,
        v_total_acoes,
        COALESCE(p_campanha->>'tipo_plano_financeiro', CASE WHEN v_count_parcelas > 1 THEN 'PARCELADO' ELSE 'A_VISTA' END)
    ) RETURNING id INTO v_campanha_id;

    -- [F] Inserção das Ações Comerciais
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
            status_financeiro,
            acao_origem_recorrencia_id,
            is_materializada_futura
        ) VALUES (
            v_campanha_id,
            v_rede,
            v_codigo_matriz,
            (v_acao->>'data_inicio')::date,
            (v_acao->>'data_fim')::date,
            COALESCE(v_acao->>'date_mode', 'single'),
            v_acao->>'tipo_acao',
            COALESCE(v_acao->>'tipo_acao_detalhe', 'Ação de Vendas'),
            v_acao->>'familia_produto',
            COALESCE(v_acao->'familias_detalhes', '[]'::jsonb),
            COALESCE((v_acao->>'preco_flat')::numeric, 0),
            COALESCE((v_acao->>'preco_acao')::numeric, 0),
            COALESCE((v_acao->>'valor_investimento')::numeric, 0),
            COALESCE((v_acao->>'expectativa_volume')::numeric, 0),
            COALESCE(v_acao->>'abrangencia', 'Família'),
            COALESCE(v_acao->>'tipo_pagamento', 'Transf. Bancária'),
            COALESCE(v_acao->'skus_detalhes', '[]'::jsonb),
            COALESCE(v_acao->>'mes_referencia', v_mes_referencia),
            COALESCE((v_acao->>'fase_atual')::integer, 1),
            v_is_planejamento,
            COALESCE(v_acao->'alertas_preventivos', '[]'::jsonb),
            'NAO_FATURADA',
            (v_acao->>'acao_origem_recorrencia_id')::uuid,
            COALESCE((v_acao->>'is_materializada_futura')::boolean, false)
        );
    END LOOP;

    -- [G] Inserção da Grade de Parcelas Financeiras
    IF p_parcelas IS NOT NULL AND jsonb_array_length(p_parcelas) > 0 THEN
        FOR v_parc IN SELECT * FROM jsonb_array_elements(p_parcelas) LOOP
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
                v_campanha_id,
                (v_parc->>'numero_parcela')::integer,
                COALESCE((v_parc->>'total_parcelas')::integer, v_count_parcelas),
                (v_parc->>'valor_previsto')::numeric,
                (v_parc->>'valor_previsto')::numeric,
                0.00,
                (v_parc->>'valor_previsto')::numeric,
                (v_parc->>'data_vencimento')::date,
                'PENDENTE',
                COALESCE(v_parc->>'tipo_pagamento', 'Transf. Bancária'),
                v_is_planejamento,
                v_parc->>'observacoes'
            );
        END LOOP;
    ELSE
        -- Criação da parcela única à vista
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
            is_planejamento
        ) VALUES (
            v_campanha_id,
            1,
            1,
            v_total_acoes,
            v_total_acoes,
            0.00,
            v_total_acoes,
            (SELECT MIN((elem->>'data_inicio')::date) FROM jsonb_array_elements(p_acoes) elem),
            'PENDENTE',
            'Transf. Bancária',
            v_is_planejamento
        );
    END IF;

    -- [H] Registro em Audit Log
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_campanhas',
        'CRIAR_NEGOCIACAO_COMPLETA',
        p_user_id,
        jsonb_build_object(
            'campanha_id', v_campanha_id,
            'rede', v_rede,
            'codigo_matriz', v_codigo_matriz,
            'mes_referencia', v_mes_referencia,
            'valor_total_projetado', v_total_acoes,
            'total_acoes', v_count_acoes,
            'total_parcelas', v_count_parcelas,
            'is_planejamento', v_is_planejamento,
            'idempotency_key', p_idempotency_key,
            'criado_por', p_user_id,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'campanha_id', v_campanha_id,
        'total_acoes', v_count_acoes,
        'total_parcelas', v_count_parcelas,
        'valor_total', v_total_acoes
    );
END;
$$;

-- 9. RPC: registrar_baixa_financeira_v1
CREATE OR REPLACE FUNCTION public.registrar_baixa_financeira_v1(
    p_campanha_id UUID,
    p_valor_pago NUMERIC(14,2),
    p_data_pagamento DATE,
    p_comprovante_url TEXT DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL,
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
    v_pagamento_id UUID;
    v_saldo_disponivel NUMERIC(14,2);
    v_parc RECORD;
    v_alocar NUMERIC(14,2);
    v_calc_saldo NUMERIC(14,2);
    v_total_alocado_evento NUMERIC(14,2) := 0.00;
    v_existing_audit RECORD;
    v_alocacoes_json JSONB := '[]'::jsonb;
BEGIN
    -- [A] Validações Básicas
    IF p_campanha_id IS NULL THEN
        RAISE EXCEPTION 'ID da negociação/campanha é obrigatório.';
    END IF;

    IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
        RAISE EXCEPTION 'Valor do pagamento deve ser estritamente maior que zero.';
    END IF;

    IF p_data_pagamento IS NULL THEN
        RAISE EXCEPTION 'Data do pagamento é obrigatória.';
    END IF;

    -- [B] Idempotência com Advisory Lock
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) <> '' THEN
        PERFORM pg_advisory_xact_lock(hashtext('baixa_idempotency_' || p_idempotency_key));

        SELECT * INTO v_existing_audit
        FROM public.cm_audit_logs
        WHERE action = 'REGISTRAR_PAGAMENTO'
          AND (new_data->>'idempotency_key' = p_idempotency_key)
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'pagamento_id', v_existing_audit.new_data->>'pagamento_id',
                'message', 'Pagamento já processado anteriormente (idempotente).'
            );
        END IF;
    END IF;

    -- [C] Lock Transacional na Campanha
    PERFORM pg_advisory_xact_lock(hashtext('baixa_fin_' || p_campanha_id::text));

    SELECT * INTO v_campanha
    FROM public.cm_campanhas
    WHERE id = p_campanha_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Negociação % não encontrada.', p_campanha_id;
    END IF;

    -- [D] Inserção do Evento Mestre de Pagamento
    INSERT INTO public.cm_investimento_pagamentos (
        campanha_id,
        valor_pago,
        data_pagamento,
        comprovante_url,
        observacoes,
        registrado_por
    ) VALUES (
        p_campanha_id,
        p_valor_pago,
        p_data_pagamento,
        p_comprovante_url,
        p_observacoes,
        p_user_id
    ) RETURNING id INTO v_pagamento_id;

    -- [E] Amortização FIFO e Criação das Alocações N:N
    v_saldo_disponivel := p_valor_pago;

    FOR v_parc IN 
        SELECT * 
        FROM public.cm_investimento_parcelas
        WHERE campanha_id = p_campanha_id 
          AND status_parcela IN ('PENDENTE', 'PARCIALMENTE_PAGA')
        ORDER BY numero_parcela ASC 
        FOR UPDATE
    LOOP
        EXIT WHEN v_saldo_disponivel <= 0;

        v_alocar := LEAST(v_saldo_disponivel, v_parc.saldo_remanescente);

        IF v_alocar > 0 THEN
            -- Inserir registro na tabela associativa de alocação
            INSERT INTO public.cm_investimento_pagamento_alocacoes (
                pagamento_id,
                parcela_id,
                valor_alocado
            ) VALUES (
                v_pagamento_id,
                v_parc.id,
                v_alocar
            );

            -- Atualizar a parcela correspondente
            UPDATE public.cm_investimento_parcelas
            SET
                valor_pago_acumulado = valor_pago_acumulado + v_alocar,
                saldo_remanescente = saldo_remanescente - v_alocar,
                status_parcela = CASE 
                    WHEN (saldo_remanescente - v_alocar) <= 0.001 THEN 'QUITADA'
                    ELSE 'PARCIALMENTE_PAGA'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_parc.id;

            v_saldo_disponivel := v_saldo_disponivel - v_alocar;
            v_total_alocado_evento := v_total_alocado_evento + v_alocar;

            v_alocacoes_json := v_alocacoes_json || jsonb_build_object(
                'parcela_id', v_parc.id,
                'numero_parcela', v_parc.numero_parcela,
                'valor_alocado', v_alocar,
                'status_novo', CASE WHEN (v_parc.saldo_remanescente - v_alocar) <= 0.001 THEN 'QUITADA' ELSE 'PARCIALMENTE_PAGA' END
            );
        END IF;
    END LOOP;

    -- [F] Reconciliação Estrita da Fonte de Verdade Financeira
    SELECT COALESCE(SUM(saldo_remanescente), 0.00)
    INTO v_calc_saldo
    FROM public.cm_investimento_parcelas
    WHERE campanha_id = p_campanha_id
      AND status_parcela NOT IN ('CANCELADA_QUITACAO_ANTECIPADA', 'CANCELADA_RENEGOCIACAO');

    -- Atualizar saldo consolidado na campanha
    UPDATE public.cm_campanhas
    SET
        saldo_financeiro_devedor = v_calc_saldo,
        status_financeiro = CASE 
            WHEN v_calc_saldo <= 0.001 THEN 'QUITADA'
            WHEN v_calc_saldo < valor_total_projetado THEN 'PARCIALMENTE_ABATIDA'
            ELSE 'ABERTA'
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_campanha_id;

    -- [G] Registro de Auditoria Forense
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_investimento_pagamentos',
        'REGISTRAR_PAGAMENTO',
        p_user_id,
        jsonb_build_object(
            'pagamento_id', v_pagamento_id,
            'campanha_id', p_campanha_id,
            'valor_pago', p_valor_pago,
            'total_alocado', v_total_alocado_evento,
            'saldo_excedente_nao_alocado', v_saldo_disponivel,
            'novo_saldo_devedor_campanha', v_calc_saldo,
            'alocacoes', v_alocacoes_json,
            'data_pagamento', p_data_pagamento,
            'comprovante_url', p_comprovante_url,
            'idempotency_key', p_idempotency_key,
            'registrado_por', p_user_id,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'pagamento_id', v_pagamento_id,
        'campanha_id', p_campanha_id,
        'valor_pago', p_valor_pago,
        'total_alocado', v_total_alocado_evento,
        'saldo_devedor_remanescente', v_calc_saldo,
        'status_financeiro', CASE WHEN v_calc_saldo <= 0.001 THEN 'QUITADA' ELSE 'PARCIALMENTE_ABATIDA' END
    );
END;
$$;

-- 10. RPC: cancelar_parcelas_futuras_v1 (Quitação Antecipada)
CREATE OR REPLACE FUNCTION public.cancelar_parcelas_futuras_v1(
    p_campanha_id UUID,
    p_user_id UUID,
    p_motivo TEXT DEFAULT 'Quitação antecipada'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_canceladas INTEGER := 0;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('cancel_parc_' || p_campanha_id::text));

    UPDATE public.cm_investimento_parcelas
    SET
        status_parcela = 'CANCELADA_QUITACAO_ANTECIPADA',
        saldo_remanescente = 0.00,
        observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelada: ' || p_motivo,
        updated_at = timezone('utc'::text, now())
    WHERE campanha_id = p_campanha_id
      AND status_parcela = 'PENDENTE'
      AND valor_pago_acumulado = 0.00;

    GET DIAGNOSTICS v_canceladas = ROW_COUNT;

    -- Registro de auditoria
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_investimento_parcelas',
        'CANCELAR_PARCELAS_QUITACAO',
        p_user_id,
        jsonb_build_object(
            'campanha_id', p_campanha_id,
            'parcelas_canceladas', v_canceladas,
            'motivo', p_motivo,
            'timestamp', now()
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'campanha_id', p_campanha_id,
        'parcelas_canceladas', v_canceladas
    );
END;
$$;

-- 11. RPC: reconciliar_financeiro_campanha_v1
CREATE OR REPLACE FUNCTION public.reconciliar_financeiro_campanha_v1(p_campanha_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_campanha RECORD;
    v_total_acoes NUMERIC(14,2);
    v_total_parcelas_orig NUMERIC(14,2);
    v_total_pago_acumulado NUMERIC(14,2);
    v_total_saldo_parcelas NUMERIC(14,2);
    v_total_pagamentos_reais NUMERIC(14,2);
    v_total_alocacoes NUMERIC(14,2);
    v_divergencia NUMERIC(14,2);
    v_is_reconciliado BOOLEAN;
BEGIN
    SELECT * INTO v_campanha FROM public.cm_campanhas WHERE id = p_campanha_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Campanha não encontrada');
    END IF;

    -- Soma das ações comerciais
    SELECT COALESCE(SUM(valor_investimento), 0.00) INTO v_total_acoes
    FROM public.cm_acoes_investimento WHERE campanha_id = p_campanha_id;

    -- Soma das parcelas
    SELECT 
        COALESCE(SUM(valor_previsto_original), 0.00),
        COALESCE(SUM(valor_pago_acumulado), 0.00),
        COALESCE(SUM(saldo_remanescente), 0.00)
    INTO v_total_parcelas_orig, v_total_pago_acumulado, v_total_saldo_parcelas
    FROM public.cm_investimento_parcelas 
    WHERE campanha_id = p_campanha_id AND status_parcela NOT IN ('CANCELADA_QUITACAO_ANTECIPADA', 'CANCELADA_RENEGOCIACAO');

    -- Soma dos pagamentos reais
    SELECT COALESCE(SUM(valor_pago), 0.00) INTO v_total_pagamentos_reais
    FROM public.cm_investimento_pagamentos WHERE campanha_id = p_campanha_id;

    -- Soma das alocações
    SELECT COALESCE(SUM(a.valor_alocado), 0.00) INTO v_total_alocacoes
    FROM public.cm_investimento_pagamento_alocacoes a
    JOIN public.cm_investimento_pagamentos p ON p.id = a.pagamento_id
    WHERE p.campanha_id = p_campanha_id;

    v_divergencia := ABS(v_total_saldo_parcelas - v_campanha.saldo_financeiro_devedor);
    v_is_reconciliado := (v_divergencia < 0.01) AND (ABS(v_total_pago_acumulado - v_total_alocacoes) < 0.01);

    RETURN jsonb_build_object(
        'campanha_id', p_campanha_id,
        'reconciliado', v_is_reconciliado,
        'total_acoes', v_total_acoes,
        'total_parcelas_original', v_total_parcelas_orig,
        'total_pago_acumulado_parcelas', v_total_pago_acumulado,
        'total_alocado_pagamentos', v_total_alocacoes,
        'total_pagamentos_reais', v_total_pagamentos_reais,
        'saldo_parcelas', v_total_saldo_parcelas,
        'saldo_campanha', v_campanha.saldo_financeiro_devedor,
        'divergencia', v_divergencia
    );
END;
$$;

-- 12. RPC: oficializar_planejamento_v2
CREATE OR REPLACE FUNCTION public.oficializar_planejamento_v2(
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
    v_parc RECORD;
    v_total_acoes NUMERIC(14,2) := 0.00;
BEGIN
    IF p_planejamento_id IS NULL THEN
        RAISE EXCEPTION 'ID do planejamento é obrigatório.';
    END IF;

    IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION 'Idempotency key é obrigatória para oficialização.';
    END IF;

    -- Locks Advisory
    PERFORM pg_advisory_xact_lock(hashtext('idempotency_key_' || p_idempotency_key));
    PERFORM pg_advisory_xact_lock(hashtext('oficializar_planejamento_v2_' || p_planejamento_id::text));

    -- Identidade de usuário
    BEGIN
        v_auth_uid := auth.uid();
        v_auth_role := current_setting('request.jwt.claim.role', true);
    EXCEPTION WHEN OTHERS THEN
        v_auth_uid := NULL;
        v_auth_role := NULL;
    END;

    IF v_auth_role = 'authenticated' OR v_auth_uid IS NOT NULL THEN
        IF p_user_id IS NOT NULL AND p_user_id IS DISTINCT FROM v_auth_uid THEN
            RAISE EXCEPTION 'Security Violation: p_user_id divergente de auth.uid()';
        END IF;
        v_effective_user_id := v_auth_uid;
    ELSE
        v_effective_user_id := COALESCE(v_auth_uid, p_user_id);
    END IF;

    -- Carregar registro do planejamento
    SELECT * INTO v_plan 
    FROM public.cm_acoes_investimento 
    WHERE id = p_planejamento_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Planejamento % não encontrado.', p_planejamento_id;
    END IF;

    IF COALESCE(v_plan.is_planejamento, false) = false THEN
        RAISE EXCEPTION 'O registro % não é um planejamento válido.', p_planejamento_id;
    END IF;

    SELECT * INTO v_campanha_origem 
    FROM public.cm_campanhas 
    WHERE id = v_plan.campanha_id;

    -- Validação de Perfil RBAC
    SELECT * INTO v_user_profile 
    FROM public.cm_user_profiles 
    WHERE id = v_effective_user_id;

    IF NOT FOUND OR COALESCE(v_user_profile.approved, false) = false THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil não aprovado.';
    END IF;

    IF v_user_profile.role = 'Gerente Regional' THEN
        IF v_campanha_origem.gerente_id IS NOT NULL AND v_campanha_origem.gerente_id IS DISTINCT FROM v_effective_user_id THEN
            RAISE EXCEPTION 'Acesso Negado: Planejamento pertence a outro gerente.';
        END IF;
    ELSIF v_user_profile.role NOT IN ('Admin', 'Admin Master', 'Trade', 'CEO', 'Diretor') THEN
        RAISE EXCEPTION 'Acesso Negado: Perfil sem autorização.';
    END IF;

    -- Checagem de Idempotência
    SELECT * INTO v_existing_audit 
    FROM public.cm_audit_logs 
    WHERE action = 'OFICIALIZAR_PLANEJAMENTO_V2'
      AND (new_data->>'idempotency_key' = p_idempotency_key)
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'campanha_id', v_existing_audit.new_data->>'campanha_id',
            'acao_id', v_existing_audit.new_data->>'acao_oficial_id',
            'planejamento_id', p_planejamento_id,
            'message', 'Oficialização v2 já processada (idempotente).'
        );
    END IF;

    -- Criação da Campanha Oficial Homologada
    INSERT INTO public.cm_campanhas (
        nome_campanha,
        rede,
        codigo_matriz,
        mes_referencia,
        status_operacional,
        status_financeiro,
        gerente_id,
        valor_total_projetado,
        saldo_financeiro_devedor,
        tipo_plano_financeiro
    ) VALUES (
        COALESCE(v_campanha_origem.nome_campanha, 'Campanha ' || v_plan.rede || ' - ' || v_plan.mes_referencia),
        v_plan.rede,
        v_plan.codigo_matriz,
        v_plan.mes_referencia,
        'PLANEJAMENTO',
        'ABERTA',
        COALESCE(v_campanha_origem.gerente_id, v_effective_user_id),
        COALESCE(v_campanha_origem.valor_total_projetado, v_plan.valor_investimento),
        COALESCE(v_campanha_origem.saldo_financeiro_devedor, v_plan.valor_investimento),
        COALESCE(v_campanha_origem.tipo_plano_financeiro, 'A_VISTA')
    ) RETURNING id INTO v_campanha_id;

    -- Criação da Ação Oficial Homologada (is_planejamento = false)
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
    ) VALUES (
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
            'oficializado_em', now(),
            'oficializado_por', v_effective_user_id
        )
    ) RETURNING id INTO v_nova_acao_id;

    -- Clonagem Oficial das Parcelas do Planejamento se existirem
    IF v_plan.campanha_id IS NOT NULL THEN
        FOR v_parc IN 
            SELECT * FROM public.cm_investimento_parcelas
            WHERE campanha_id = v_plan.campanha_id AND is_planejamento = true
            ORDER BY numero_parcela ASC
        LOOP
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
                v_campanha_id,
                v_parc.numero_parcela,
                v_parc.total_parcelas,
                v_parc.valor_previsto_original,
                v_parc.valor_previsto,
                0.00,
                v_parc.valor_previsto,
                v_parc.data_vencimento,
                'PENDENTE',
                v_parc.tipo_pagamento,
                false, -- -> PARCELA OFICIAL HOMOLOGADA
                v_parc.observacoes
            );
        END LOOP;
    END IF;

    -- Registro em Audit Log
    INSERT INTO public.cm_audit_logs (
        table_name,
        action,
        user_id,
        new_data
    ) VALUES (
        'cm_acoes_investimento',
        'OFICIALIZAR_PLANEJAMENTO_V2',
        v_effective_user_id,
        jsonb_build_object(
            'planejamento_id', p_planejamento_id,
            'acao_oficial_id', v_nova_acao_id,
            'campanha_id', v_campanha_id,
            'idempotency_key', p_idempotency_key,
            'rede', v_plan.rede,
            'codigo_matriz', v_plan.codigo_matriz,
            'mes_referencia', v_plan.mes_referencia,
            'valor_investimento', v_plan.valor_investimento,
            'oficializado_em', now(),
            'oficializado_por', v_effective_user_id
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'campanha_id', v_campanha_id,
        'acao_id', v_nova_acao_id,
        'planejamento_id', p_planejamento_id
    );
END;
$$;

-- 13. PRIVILÉGIOS DE SEGURANÇA
REVOKE ALL ON FUNCTION public.criar_negociacao_completa_v1(JSONB, JSONB, JSONB, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_negociacao_completa_v1(JSONB, JSONB, JSONB, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_baixa_financeira_v1(UUID, NUMERIC, DATE, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_baixa_financeira_v1(UUID, NUMERIC, DATE, TEXT, TEXT, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancelar_parcelas_futuras_v1(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_parcelas_futuras_v1(UUID, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reconciliar_financeiro_campanha_v1(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconciliar_financeiro_campanha_v1(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.oficializar_planejamento_v2(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficializar_planejamento_v2(UUID, UUID, TEXT) TO authenticated, service_role;
