-- Migration to add date_mode and create email tracking table

-- 1. Add date_mode column with constraint
ALTER TABLE public.cm_acoes_investimento
ADD COLUMN IF NOT EXISTS date_mode TEXT NOT NULL DEFAULT 'single'
CHECK (date_mode IN ('single', 'multiple'));

-- 2. Create cm_acoes_email_tracking table
CREATE TABLE IF NOT EXISTS public.cm_acoes_email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id UUID NOT NULL REFERENCES public.cm_acoes_investimento(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('familia', 'sku')),
  item_key TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('start_reminder', 'overdue_alert')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_acao_item_alert UNIQUE (acao_id, item_type, item_key, alert_type)
);

-- Enable RLS and add policy
ALTER TABLE public.cm_acoes_email_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.cm_acoes_email_tracking;
CREATE POLICY "Allow all authenticated users full access" ON public.cm_acoes_email_tracking
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Recreate view to include the date_mode column
CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
 WITH manager_mapping AS (
         SELECT DISTINCT ON (cm_clientes.codigo_matriz) cm_clientes.codigo_matriz,
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
    COALESCE(a.condicao_pagamento, ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE cm_clientes.codigo_matriz = a.codigo_matriz
         LIMIT 1), ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE upper(cm_clientes.matriz) = upper(a.rede)
         LIMIT 1)) AS condicao_pagamento,
    COALESCE(( SELECT mm.manager
           FROM manager_mapping mm
          WHERE mm.codigo_matriz = a.codigo_matriz
         LIMIT 1), ( SELECT mbr.manager
           FROM manager_by_rede mbr
          WHERE mbr.clean_rede = upper(a.rede)
         LIMIT 1)) AS gerente_responsavel,
    a.date_mode
   FROM cm_acoes_investimento a;
