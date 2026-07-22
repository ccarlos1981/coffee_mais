-- Migration: Exceção Oficial de Auditoria do Trade (GRV)
-- Data: 2026-07-22
-- Objetivo: Adicionar coluna checklist_sem_auditoria, atualizar view v_acoes_investimento_com_gerente e criar RPC transacional de atualização do checklist do Trade.

-- 1. Adicionar a coluna checklist_sem_auditoria na tabela cm_acoes_investimento (compatibilidade retroativa)
ALTER TABLE public.cm_acoes_investimento
  ADD COLUMN IF NOT EXISTS checklist_sem_auditoria BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Atualizar/Recriar a view v_acoes_investimento_com_gerente incluindo checklist_sem_auditoria e campos de divergência
DROP VIEW IF EXISTS public.v_acoes_investimento_com_gerente CASCADE;

CREATE VIEW public.v_acoes_investimento_com_gerente AS
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
  p_checklist_comunicacao BOOLEAN DEFAULT FALSE,
  p_checklist_logistica BOOLEAN DEFAULT FALSE,
  p_checklist_auditoria BOOLEAN DEFAULT FALSE,
  p_checklist_garantia BOOLEAN DEFAULT FALSE,
  p_checklist_conferencia BOOLEAN DEFAULT FALSE,
  p_checklist_sem_auditoria BOOLEAN DEFAULT FALSE,
  p_possui_divergencia BOOLEAN DEFAULT FALSE,
  p_motivo_divergencia TEXT DEFAULT NULL,
  p_observacao_divergencia TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enum_motivo public.motivo_divergencia_enum;
BEGIN
  -- Cast seguro de texto para enum apenas se divergencia ativa
  IF p_possui_divergencia IS TRUE AND p_motivo_divergencia IS NOT NULL AND p_motivo_divergencia <> '' THEN
    v_enum_motivo := p_motivo_divergencia::public.motivo_divergencia_enum;
  ELSE
    v_enum_motivo := NULL;
  END IF;

  -- Atualizar o checklist e divergência na tabela cm_acoes_investimento
  UPDATE public.cm_acoes_investimento
     SET checklist_comunicacao        = COALESCE(p_checklist_comunicacao, false),
         checklist_logistica          = COALESCE(p_checklist_logistica, false),
         checklist_auditoria          = COALESCE(p_checklist_auditoria, false),
         checklist_garantia           = COALESCE(p_checklist_garantia, false),
         checklist_conferencia        = COALESCE(p_checklist_conferencia, false),
         checklist_sem_auditoria      = COALESCE(p_checklist_sem_auditoria, false),
         possui_divergencia_calendario = COALESCE(p_possui_divergencia, false),
         motivo_divergencia_calendario = v_enum_motivo,
         observacao_divergencia        = CASE WHEN COALESCE(p_possui_divergencia, false) THEN p_observacao_divergencia ELSE NULL END,
         updated_at                   = NOW()
   WHERE id = p_acao_id;

  RETURN jsonb_build_object(
    'success', true,
    'action_id', p_acao_id
  );
END;
$$;

-- Permissões de execução da RPC
GRANT EXECUTE ON FUNCTION public.registrar_excecao_auditoria_trade(UUID, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
