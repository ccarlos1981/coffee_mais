-- Migration to add rejection tracking columns to cm_acoes_investimento and view

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'devolvido_por_enum') THEN
    CREATE TYPE devolvido_por_enum AS ENUM ('TRADE', 'FINANCEIRO');
  END IF;
END$$;

ALTER TABLE public.cm_acoes_investimento
ADD COLUMN IF NOT EXISTS devolvido_por devolvido_por_enum,
ADD COLUMN IF NOT EXISTS devolvido_em timestamp with time zone;

CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
 WITH manager_mapping AS (
         SELECT DISTINCT ON (cm_clientes.codigo_matriz, (upper(cm_clientes.matriz))) cm_clientes.codigo_matriz,
            upper(cm_clientes.matriz) AS clean_rede,
            cm_clientes.responsavel AS manager
           FROM cm_clientes
          WHERE cm_clientes.codigo_matriz IS NOT NULL AND cm_clientes.responsavel IS NOT NULL
        ), manager_by_rede AS (
         SELECT DISTINCT ON ((upper(cm_clientes.matriz))) upper(cm_clientes.matriz) AS clean_rede,
            cm_clientes.responsavel AS manager
           FROM cm_clientes
          WHERE cm_clientes.matriz IS NOT NULL AND cm_clientes.responsavel IS NOT NULL
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
          WHERE cm_clientes.codigo_matriz = a.codigo_matriz
         LIMIT 1), ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE upper(cm_clientes.matriz) = upper(a.rede)
         LIMIT 1)) AS condicao_pagamento,
    COALESCE(( SELECT mm.manager
           FROM manager_mapping mm
          WHERE mm.codigo_matriz = a.codigo_matriz AND mm.clean_rede = upper(a.rede)
         LIMIT 1), ( SELECT mbr.manager
           FROM manager_by_rede mbr
          WHERE mbr.clean_rede = upper(a.rede)
         LIMIT 1)) AS gerente_responsavel,
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha,
    a.devolvido_por,
    a.devolvido_em
   FROM cm_acoes_investimento a
     LEFT JOIN cm_campanhas c ON a.campanha_id = c.id;
