-- =============================================================================
-- Migration: 20260824_p0_2_dynamic_investment_ownership.sql
-- Goal: P0-2 — Resolução Dinâmica de Ownership dos Investimentos Comerciais
--
-- REGRAS MANDATÓRIAS:
-- 1. Resolução Dinâmica do Gerente:
--    Prioridade 1: Ownership vigente da Rede (cm_redes_matrizes.manager via codigo_matriz ou rede)
--    Prioridade 2: Ownership vigente do Cliente/Loja (cm_clientes.responsavel via codigo)
--    Prioridade 3: Autor original da Campanha (cm_campanhas.gerente_id via cm_user_profiles)
-- 2. Preservação de Auditoria:
--    cm_campanhas.gerente_id permanece INTACTO representando o criador original.
-- 3. Paridade Financeira:
--    0,0000% de desvio em valores, ações, campanhas ou metadados de aprovação.
--
-- ROLLBACK:
-- Executar bloco DOWN comentado no final deste arquivo.
-- =============================================================================

BEGIN;

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
    -- P0-2: Resolução Dinâmica de Ownership Vigente
    COALESCE(
      (SELECT rm.manager FROM public.cm_redes_matrizes rm WHERE rm.codigo = a.codigo_matriz LIMIT 1),
      (SELECT rm.manager FROM public.cm_redes_matrizes rm WHERE UPPER(TRIM(rm.nome)) = UPPER(TRIM(a.rede)) LIMIT 1),
      (SELECT c_loja.responsavel FROM public.cm_clientes c_loja WHERE c_loja.codigo = a.codigo LIMIT 1),
      (SELECT up.name FROM public.cm_user_profiles up WHERE up.id = c.gerente_id)
    ) AS gerente_responsavel,
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

GRANT SELECT ON public.v_acoes_investimento_com_gerente TO authenticated, anon, service_role;

COMMIT;

-- =============================================================================
-- BLOCO DOWN (ROLLBACK)
-- =============================================================================
/*
BEGIN;
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

GRANT SELECT ON public.v_acoes_investimento_com_gerente TO authenticated, anon, service_role;
COMMIT;
*/
