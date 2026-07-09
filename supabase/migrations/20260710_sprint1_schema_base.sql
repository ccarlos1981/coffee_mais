-- Migration para Sprint 1: Tabelas, Colunas, Índices e Recriação de View

-- 1. Criar a tabela cm_campanhas
CREATE TABLE IF NOT EXISTS public.cm_campanhas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_campanha TEXT, -- Opcional, NULL permitido. Sem FK ou geração automática nesta sprint.
    nome_campanha TEXT NOT NULL,
    rede TEXT NOT NULL,
    codigo_matriz TEXT,
    gerente_id UUID, -- UUID sem foreign key por enquanto, NULL permitido.
    mes_referencia TEXT NOT NULL, -- Formato: "MM/YYYY" ou "YYYY-MM"
    status_operacional TEXT NOT NULL DEFAULT 'PLANEJAMENTO' CHECK (status_operacional IN ('PLANEJAMENTO', 'VALIDACAO', 'EXECUCAO', 'CONCLUIDA', 'CANCELADA')),
    status_financeiro TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status_financeiro IN ('ABERTA', 'PARCIALMENTE_ABATIDA', 'QUITADA')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS e criar política de acesso total para usuários autenticados em cm_campanhas
ALTER TABLE public.cm_campanhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.cm_campanhas;
CREATE POLICY "Allow all authenticated users full access" 
ON public.cm_campanhas 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Adicionar campos em cm_acoes_investimento (como opcionais)
ALTER TABLE public.cm_acoes_investimento
ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES public.cm_campanhas(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'NAO_FATURADA' CHECK (status_financeiro IN ('NAO_FATURADA', 'PARCIALMENTE_ABATIDA', 'QUITADA', 'GLOSADA'));

-- 4. Criar índices de performance
CREATE INDEX IF NOT EXISTS idx_cm_acoes_campanha_id ON public.cm_acoes_investimento(campanha_id);
CREATE INDEX IF NOT EXISTS idx_cm_campanhas_codigo ON public.cm_campanhas(codigo_campanha);

-- 5. Atualizar v_acoes_investimento_com_gerente para expor os novos campos
DROP VIEW IF EXISTS public.v_acoes_investimento_com_gerente;

CREATE VIEW public.v_acoes_investimento_com_gerente AS
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
          WHERE mm.codigo_matriz = a.codigo_matriz
         LIMIT 1), ( SELECT mbr.manager
           FROM manager_by_rede mbr
          WHERE mbr.clean_rede = upper(a.rede)
         LIMIT 1)) AS gerente_responsavel,
    -- Novos campos para a View
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao
   FROM public.cm_acoes_investimento a;
