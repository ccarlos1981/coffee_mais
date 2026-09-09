    -- Migration: 20260909_gate_5_16_fase3_view_diagnostico_exclusao.sql
-- Description: Adequação da View de Diagnóstico v_acoes_investimento_com_gerente (RDM Gate 5.16 Fase 3)
-- Objetivo: Fornecer diagnóstico financeiro descritivo alinhado à máquina de estados da RPC v2
--           Elimina bloqueio binário indevido de FUTURE_ONLY preservando histórico realizado e multi-ações
-- Baseline: BASELINE_INVESTIMENTOS_20260909_LOCKED

CREATE OR REPLACE VIEW public.v_acoes_investimento_com_gerente AS
WITH diag_metrics AS (
    SELECT 
        a.id AS acao_id,
        -- Boletos pagos
        (
            COALESCE((
                SELECT COUNT(*) 
                FROM public.cm_acoes_boletos_vinculo vb
                JOIN public.cm_boletos b ON b.id = vb.boleto_id
                WHERE vb.acao_id = a.id AND b.status IN ('PAGO', 'BAIXADO', 'QUITADO')
            ), 0)
            +
            CASE 
                WHEN a.apuracao_boleto_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.cm_boletos b2 
                    WHERE b2.id = a.apuracao_boleto_id AND b2.status IN ('PAGO', 'BAIXADO', 'QUITADO')
                ) THEN 1 
                ELSE 0 
            END
        )::integer AS boletos_pagos_count,
        
        -- Boletos abertos
        (
            COALESCE((
                SELECT COUNT(*) 
                FROM public.cm_acoes_boletos_vinculo vb
                JOIN public.cm_boletos b ON b.id = vb.boleto_id
                WHERE vb.acao_id = a.id AND b.status NOT IN ('PAGO', 'BAIXADO', 'QUITADO')
            ), 0)
            +
            CASE 
                WHEN a.apuracao_boleto_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.cm_boletos b2 
                    WHERE b2.id = a.apuracao_boleto_id AND b2.status NOT IN ('PAGO', 'BAIXADO', 'QUITADO')
                ) THEN 1 
                ELSE 0 
            END
        )::integer AS boletos_abertos_count,

        -- Contexto da Campanha
        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_acoes_investimento a2 
                WHERE a2.campanha_id = a.campanha_id AND a2.id <> a.id AND a2.cancel_reason IS NULL
            )
        END AS outras_acoes_ativas_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 1::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_acoes_investimento a3 
                WHERE a3.campanha_id = a.campanha_id
            )
        END AS total_acoes_historicas_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_investimento_pagamentos pg 
                WHERE pg.campanha_id = a.campanha_id
            )
        END AS pagamentos_realizados_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_investimento_parcelas p 
                WHERE p.campanha_id = a.campanha_id
            )
        END AS total_parcelas_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_investimento_parcelas p 
                WHERE p.campanha_id = a.campanha_id 
                  AND p.status_parcela = 'PENDENTE' 
                  AND COALESCE(p.valor_pago_acumulado, 0.00) = 0.00
            )
        END AS parcelas_futuras_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_investimento_parcelas p 
                WHERE p.campanha_id = a.campanha_id 
                  AND (COALESCE(p.valor_pago_acumulado, 0.00) > 0.00 OR p.status_parcela = 'QUITADA')
            )
        END AS parcelas_pagas_count,

        CASE 
            WHEN a.campanha_id IS NULL THEN 0::integer
            ELSE (
                SELECT COUNT(*)::integer 
                FROM public.cm_investimento_parcelas p 
                WHERE p.campanha_id = a.campanha_id 
                  AND p.status_parcela = 'PARCIALMENTE_PAGA' 
                  AND COALESCE(p.saldo_remanescente, 0.00) > 0.00
            )
        END AS parcelas_parciais_count
    FROM public.cm_acoes_investimento a
)
SELECT 
    a.id,
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
    a.is_test,
    COALESCE(a.condicao_pagamento, ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE cm_clientes.codigo_matriz = a.codigo_matriz
         LIMIT 1), ( SELECT cm_clientes.condicao_pagamento
           FROM cm_clientes
          WHERE upper(cm_clientes.matriz) = upper(a.rede)
         LIMIT 1)) AS condicao_pagamento,
    ( SELECT up.name
           FROM cm_user_profiles up
          WHERE up.id = c.gerente_id) AS gerente_responsavel,
    a.campanha_id,
    a.status_financeiro AS status_financeiro_acao,
    c.codigo_campanha,
    c.nome_campanha,
    c.status_operacional AS status_operacional_campanha,
    c.status_financeiro AS status_financeiro_campanha,
    a.devolvido_por,
    a.devolvido_em,

    -- [COLUNA 94: RETROCOMPATIBILIDADE CANÔNICA]
    -- Não bloqueia FUTURE_ONLY! Bloqueia estritamente quando há histórico financeiro realizado ou ambiguidade multi-ações
    (
        CASE
            WHEN (
                (m.outras_acoes_ativas_count > 0 AND (m.total_parcelas_count > 0 OR m.pagamentos_realizados_count > 0))
                OR
                (m.total_acoes_historicas_count > 1 AND (m.pagamentos_realizados_count > 0 OR m.parcelas_pagas_count > 0))
            ) THEN true
            WHEN (
                a.financeiro_pago_em IS NOT NULL
                OR m.boletos_pagos_count > 0
                OR (m.parcelas_pagas_count > 0 AND m.parcelas_futuras_count = 0 AND m.parcelas_parciais_count = 0)
                OR (m.pagamentos_realizados_count > 0 AND COALESCE(c.saldo_financeiro_devedor, 0) <= 0.001)
            ) THEN true
            WHEN (
                (m.parcelas_pagas_count > 0 OR m.pagamentos_realizados_count > 0)
                AND (m.parcelas_futuras_count > 0 OR m.parcelas_parciais_count > 0)
            ) THEN true
            ELSE false
        END
    ) AS possui_dependencia_financeira,

    -- [COLUNAS 95+: EXTENSÃO DIAGNÓSTICA READ-ONLY RDM FASE 3]
    (
        CASE
            -- F.1: Hard Gate Multi-Ações (Decisão Executiva 1 / Opção A)
            WHEN (
                (m.outras_acoes_ativas_count > 0 AND (m.total_parcelas_count > 0 OR m.pagamentos_realizados_count > 0))
                OR
                (m.total_acoes_historicas_count > 1 AND (m.pagamentos_realizados_count > 0 OR m.parcelas_pagas_count > 0))
            ) THEN 'MULTI_ACTION_FINANCIAL_AMBIGUOUS'

            -- F.2: Histórico Totalmente Realizado / Liquidado
            WHEN (
                a.financeiro_pago_em IS NOT NULL
                OR m.boletos_pagos_count > 0
                OR (m.parcelas_pagas_count > 0 AND m.parcelas_futuras_count = 0 AND m.parcelas_parciais_count = 0)
                OR (m.pagamentos_realizados_count > 0 AND COALESCE(c.saldo_financeiro_devedor, 0) <= 0.001)
            ) THEN 'FULLY_REALIZED'

            -- F.3: Amortização Parcial com Saldo Futuro Remanescente
            WHEN (
                (m.parcelas_pagas_count > 0 OR m.pagamentos_realizados_count > 0)
                AND (m.parcelas_futuras_count > 0 OR m.parcelas_parciais_count > 0)
            ) THEN 'PARTIAL_REALIZED'

            -- F.4: Compromissos Estritamente Futuros
            WHEN (
                (m.parcelas_futuras_count > 0 OR m.boletos_abertos_count > 0)
                AND m.parcelas_pagas_count = 0 
                AND m.pagamentos_realizados_count = 0 
                AND m.boletos_pagos_count = 0 
                AND a.financeiro_pago_em IS NULL
            ) THEN 'FUTURE_ONLY'

            -- F.5: Totalmente Limpa de Vínculos Financeiros
            ELSE 'CLEAN'
        END
    ) AS diagnostico_exclusao,

    (
        CASE
            WHEN (
                (m.outras_acoes_ativas_count > 0 AND (m.total_parcelas_count > 0 OR m.pagamentos_realizados_count > 0))
                OR
                (m.total_acoes_historicas_count > 1 AND (m.pagamentos_realizados_count > 0 OR m.parcelas_pagas_count > 0))
            ) THEN 'Ação vinculada a negociação multi-ação com compromisso financeiro compartilhado. Ajuste a negociação master antes da exclusão individual.'
            WHEN (
                a.financeiro_pago_em IS NOT NULL
                OR m.boletos_pagos_count > 0
                OR (m.parcelas_pagas_count > 0 AND m.parcelas_futuras_count = 0 AND m.parcelas_parciais_count = 0)
                OR (m.pagamentos_realizados_count > 0 AND COALESCE(c.saldo_financeiro_devedor, 0) <= 0.001)
            ) THEN 'Ação com histórico financeiro liquidado ou pagamento confirmado. Preservação contábil obrigatória.'
            WHEN (
                (m.parcelas_pagas_count > 0 OR m.pagamentos_realizados_count > 0)
                AND (m.parcelas_futuras_count > 0 OR m.parcelas_parciais_count > 0)
            ) THEN 'Ação com amortização parcial já realizada. Preservação contábil obrigatória.'
            ELSE NULL
        END
    ) AS motivo_bloqueio_exclusao,

    (
        CASE
            WHEN (
                (m.outras_acoes_ativas_count > 0 AND (m.total_parcelas_count > 0 OR m.pagamentos_realizados_count > 0))
                OR
                (m.total_acoes_historicas_count > 1 AND (m.pagamentos_realizados_count > 0 OR m.parcelas_pagas_count > 0))
            ) THEN false
            WHEN (
                a.financeiro_pago_em IS NOT NULL
                OR m.boletos_pagos_count > 0
                OR (m.parcelas_pagas_count > 0 AND m.parcelas_futuras_count = 0 AND m.parcelas_parciais_count = 0)
                OR (m.pagamentos_realizados_count > 0 AND COALESCE(c.saldo_financeiro_devedor, 0) <= 0.001)
            ) THEN false
            WHEN (
                (m.parcelas_pagas_count > 0 OR m.pagamentos_realizados_count > 0)
                AND (m.parcelas_futuras_count > 0 OR m.parcelas_parciais_count > 0)
            ) THEN false
            ELSE true
        END
    ) AS elegivel_exclusao_admin,

    m.parcelas_futuras_count,
    m.parcelas_pagas_count,
    m.boletos_pagos_count,
    m.boletos_abertos_count,
    m.pagamentos_realizados_count,
    m.outras_acoes_ativas_count,
    m.total_acoes_historicas_count
FROM public.cm_acoes_investimento a
LEFT JOIN public.cm_campanhas c ON a.campanha_id = c.id
JOIN diag_metrics m ON m.acao_id = a.id;

GRANT SELECT ON public.v_acoes_investimento_com_gerente TO authenticated, anon, service_role;
