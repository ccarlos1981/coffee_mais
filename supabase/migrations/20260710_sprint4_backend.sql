-- Migration para Sprint 4: Backend Setup, Triggers e View de Campanhas

BEGIN;

-- 1. Criar ou substituir a função de geração automática de código de campanha concorrente-safe
CREATE OR REPLACE FUNCTION public.generate_codigo_campanha()
RETURNS TRIGGER AS $$
DECLARE
    v_prefix TEXT;
    v_period TEXT;
    v_seq INTEGER := 1;
    v_code TEXT;
    v_exists BOOLEAN;
BEGIN
    IF NEW.codigo_campanha IS NULL THEN
        -- Extrai prefixo: 3 primeiras letras da rede limpas
        v_prefix := UPPER(REGEXP_REPLACE(COALESCE(NEW.rede, 'CMP'), '[^A-Za-z]', '', 'g'));
        IF length(v_prefix) < 3 THEN
            v_prefix := RPAD(v_prefix, 3, 'X');
        ELSE
            v_prefix := SUBSTRING(v_prefix FROM 1 FOR 3);
        END IF;

        -- Período YYYYMM
        v_period := REPLACE(COALESCE(NEW.mes_referencia, to_char(CURRENT_DATE, 'YYYY-MM')), '-', '');

        -- Loop anticolisão concorrente (Race-Condition Safe)
        LOOP
            v_code := v_prefix || '-' || v_period || '-' || lpad(v_seq::text, 3, '0');
            
            SELECT EXISTS(SELECT 1 FROM public.cm_campanhas WHERE codigo_campanha = v_code)
            INTO v_exists;
            
            IF NOT v_exists THEN
                NEW.codigo_campanha := v_code;
                EXIT;
            END IF;
            
            v_seq := v_seq + 1;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Vincular trigger BEFORE INSERT à cm_campanhas
DROP TRIGGER IF EXISTS trg_generate_codigo_campanha ON public.cm_campanhas;
CREATE TRIGGER trg_generate_codigo_campanha
BEFORE INSERT ON public.cm_campanhas
FOR EACH ROW
EXECUTE FUNCTION public.generate_codigo_campanha();

-- 3. Atualizar dados históricos das campanhas criadas anteriormente de forma segura (Partition por prefixo)
UPDATE public.cm_campanhas c
SET codigo_campanha = seq.new_code
FROM (
    SELECT 
        id,
        v_prefix || '-' || REPLACE(COALESCE(mes_referencia, to_char(created_at, 'YYYY-MM')), '-', '') || '-' || LPAD((row_number() OVER (PARTITION BY v_prefix, mes_referencia ORDER BY id))::text, 3, '0') AS new_code
    FROM public.cm_campanhas
    CROSS JOIN LATERAL (
        SELECT 
            CASE 
                WHEN length(UPPER(REGEXP_REPLACE(COALESCE(rede, 'CMP'), '[^A-Za-z]', '', 'g'))) < 3 
                THEN RPAD(UPPER(REGEXP_REPLACE(COALESCE(rede, 'CMP'), '[^A-Za-z]', '', 'g')), 3, 'X')
                ELSE SUBSTRING(UPPER(REGEXP_REPLACE(COALESCE(rede, 'CMP'), '[^A-Za-z]', '', 'g')) FROM 1 FOR 3)
            END AS v_prefix
    ) pref
) seq
WHERE c.id = seq.id;

-- 4. Adicionar Unique Constraint na coluna codigo_campanha de cm_campanhas
ALTER TABLE public.cm_campanhas DROP CONSTRAINT IF EXISTS unique_codigo_campanha;
ALTER TABLE public.cm_campanhas ADD CONSTRAINT unique_codigo_campanha UNIQUE (codigo_campanha);

-- 5. Atualizar v_acoes_investimento_com_gerente para expor os metadados de campanha
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
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    -- Campos da campanha obtidos via join
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha
   FROM public.cm_acoes_investimento a
   LEFT JOIN public.cm_campanhas c ON a.campanha_id = c.id;

COMMIT;
