-- Migration: Exceção Oficial de Auditoria do Trade (GRV)
-- Data: 2026-07-22
-- Objetivo: Adicionar coluna checklist_sem_auditoria, atualizar view v_acoes_investimento_com_gerente e criar RPC transacional registrar_excecao_auditoria_trade.

-- 1. Adicionar a coluna checklist_sem_auditoria na tabela cm_acoes_investimento (compatibilidade retroativa)
ALTER TABLE public.cm_acoes_investimento
  ADD COLUMN IF NOT EXISTS checklist_sem_auditoria BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Atualizar/Recriar a view v_acoes_investimento_com_gerente incluindo checklist_sem_auditoria e campos de divergência
CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
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
    a.apuracao_valor_realized,
    a.apuracao_evidencias_url,
    a.apuracao_boleto_id,
    a.checklist_conferencia,
    a.checklist_sem_auditoria,
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
    a.possui_divergencia_calendario,
    a.data_inicio_real,
    a.data_fim_real,
    a.motivo_divergencia_calendario,
    a.observacao_divergencia,
    COALESCE(a.condicao_pagamento, ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE (cm_clientes.codigo_matriz = a.codigo_matriz)
         LIMIT 1), ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE (upper(cm_clientes.matriz) = upper(a.rede))
         LIMIT 1)) AS condicao_pagamento,
    ( SELECT up.name
           FROM public.cm_user_profiles up
          WHERE (up.id = c.gerente_id)) AS gerente_responsavel,
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha,
    a.devolvido_por,
    a.devolvido_em
   FROM (public.cm_acoes_investimento a
     LEFT JOIN public.cm_campanhas c ON ((a.campanha_id = c.id)));

-- 3. Função RPC PostgreSQL Transacional registrar_excecao_auditoria_trade
CREATE OR REPLACE FUNCTION public.registrar_excecao_auditoria_trade(
  p_acao_id UUID,
  p_checklist_comunicacao BOOLEAN,
  p_checklist_logistica BOOLEAN,
  p_checklist_auditoria BOOLEAN,
  p_checklist_garantia BOOLEAN,
  p_checklist_conferencia BOOLEAN,
  p_checklist_sem_auditoria BOOLEAN,
  p_possui_divergencia BOOLEAN DEFAULT FALSE,
  p_motivo_divergencia public.motivo_divergencia_enum DEFAULT NULL,
  p_observacao_divergencia TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_sem_auditoria BOOLEAN;
  v_transition_triggered BOOLEAN := FALSE;
  v_codigo TEXT;
  v_campanha_nome TEXT;
  v_gerente_responsavel TEXT;
  v_usuario_nome TEXT := 'Sistema';
BEGIN
  -- 1. Bloqueio pessimista para leitura do valor anterior e garantia de atomicidade
  SELECT checklist_sem_auditoria
    INTO v_old_sem_auditoria
    FROM public.cm_acoes_investimento
   WHERE id = p_acao_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ação de investimento % não encontrada.', p_acao_id;
  END IF;

  -- 2. Atualizar o checklist e divergência na tabela cm_acoes_investimento
  UPDATE public.cm_acoes_investimento
     SET checklist_comunicacao        = COALESCE(p_checklist_comunicacao, false),
         checklist_logistica          = COALESCE(p_checklist_logistica, false),
         checklist_auditoria          = COALESCE(p_checklist_auditoria, false),
         checklist_garantia           = COALESCE(p_checklist_garantia, false),
         checklist_conferencia        = COALESCE(p_checklist_conferencia, false),
         checklist_sem_auditoria      = COALESCE(p_checklist_sem_auditoria, false),
         possui_divergencia_calendario = COALESCE(p_possui_divergencia, false),
         motivo_divergencia_calendario = CASE WHEN COALESCE(p_possui_divergencia, false) THEN p_motivo_divergencia ELSE NULL END,
         observacao_divergencia        = CASE WHEN COALESCE(p_possui_divergencia, false) THEN p_observacao_divergencia ELSE NULL END,
         updated_at                   = NOW()
   WHERE id = p_acao_id;

  -- 3. Avaliar transição estrita FALSE -> TRUE
  IF COALESCE(v_old_sem_auditoria, false) = FALSE AND COALESCE(p_checklist_sem_auditoria, false) = TRUE THEN
    v_transition_triggered := TRUE;

    -- Obter metadados da ação via view oficial
    SELECT codigo, nome_campanha, gerente_responsavel
      INTO v_codigo, v_campanha_nome, v_gerente_responsavel
      FROM public.v_acoes_investimento_com_gerente
     WHERE id = p_acao_id;

    -- Obter nome do usuário responsavel
    IF p_user_id IS NOT NULL THEN
      SELECT name INTO v_usuario_nome
        FROM public.cm_user_profiles
       WHERE id = p_user_id;
      IF v_usuario_nome IS NULL THEN
        v_usuario_nome := 'Usuário (' || p_user_id || ')';
      END IF;
    END IF;

    -- Inserir registro completo e auditável em cm_audit_logs dentro da mesma transação
    INSERT INTO public.cm_audit_logs (
      table_name,
      action,
      user_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      'cm_acoes_investimento',
      'EXCECAO_AUDITORIA_TRADE',
      p_user_id,
      jsonb_build_object(
        'id', p_acao_id,
        'checklist_sem_auditoria', false
      ),
      jsonb_build_object(
        'id', p_acao_id,
        'codigo', v_codigo,
        'campanha_nome', v_campanha_nome,
        'gerente_responsavel', v_gerente_responsavel,
        'usuario_responsavel', v_usuario_nome,
        'data_hora', NOW(),
        'valor_anterior', false,
        'valor_novo', true,
        'evento', 'EXCECAO_AUDITORIA_TRADE',
        'descricao', 'Exceção de Auditoria autorizada pelo GRV',
        'checklist_sem_auditoria', true
      ),
      NOW()
    );
  END IF;

  -- 4. Retornar estrutura JSON padronizada
  RETURN jsonb_build_object(
    'success', true,
    'transition_triggered', v_transition_triggered,
    'action_id', p_acao_id,
    'audit_log_created', v_transition_triggered
  );
END;
$$;

-- Permissões de execução da RPC
GRANT EXECUTE ON FUNCTION public.registrar_excecao_auditoria_trade(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, public.motivo_divergencia_enum, TEXT, UUID) TO anon, authenticated, service_role;
