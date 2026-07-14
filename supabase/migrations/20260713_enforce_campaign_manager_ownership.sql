-- 1. Create Profile for Inside Sales if not exists
INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role)
VALUES (
  '77777777-7777-7777-7777-777777777777', 
  'insidesales@coffeemais.com', 
  '{"name": "Inside Sales"}'::jsonb, 
  '{"provider": "email", "providers": ["email"]}'::jsonb, 
  'authenticated', 
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cm_user_profiles (id, name, role, approved)
VALUES ('77777777-7777-7777-7777-777777777777', 'Inside Sales', 'Gerente Regional', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create missing campaigns for actions that have NULL campanha_id
DO $$
DECLARE
  c_imperatriz_id uuid;
  c_bistek_id uuid;
  c_brasil_id uuid;
  c_zaffari_id uuid;
  c_zonasul_id uuid;
BEGIN
  -- Imperatriz
  IF EXISTS (SELECT 1 FROM cm_acoes_investimento WHERE rede = 'IMPERATRIZ' AND mes_referencia = '2026-06' AND campanha_id IS NULL) THEN
    c_imperatriz_id := gen_random_uuid();
    INSERT INTO cm_campanhas (id, codigo_campanha, nome_campanha, rede, codigo_matriz, mes_referencia, status_operacional, status_financeiro, gerente_id)
    VALUES (c_imperatriz_id, 'IMP-202606-AUTO-' || substring(gen_random_uuid()::text from 1 for 8), 'Campanha IMPERATRIZ - 2026-06 - AutoCreated', 'IMPERATRIZ', '70563.0', '2026-06', 'PLANEJAMENTO', 'ABERTA', 'b447f539-4f65-41d3-a113-238c246fcd7f');
    
    UPDATE cm_acoes_investimento SET campanha_id = c_imperatriz_id WHERE rede = 'IMPERATRIZ' AND mes_referencia = '2026-06' AND campanha_id IS NULL;
  END IF;

  -- Bistek
  IF EXISTS (SELECT 1 FROM cm_acoes_investimento WHERE rede = 'BISTEK' AND mes_referencia = '2026-06' AND campanha_id IS NULL) THEN
    c_bistek_id := gen_random_uuid();
    INSERT INTO cm_campanhas (id, codigo_campanha, nome_campanha, rede, codigo_matriz, mes_referencia, status_operacional, status_financeiro, gerente_id)
    VALUES (c_bistek_id, 'BIS-202606-AUTO-' || substring(gen_random_uuid()::text from 1 for 8), 'Campanha BISTEK - 2026-06 - AutoCreated', 'BISTEK', '146775.0', '2026-06', 'PLANEJAMENTO', 'ABERTA', 'b447f539-4f65-41d3-a113-238c246fcd7f');
    
    UPDATE cm_acoes_investimento SET campanha_id = c_bistek_id WHERE rede = 'BISTEK' AND mes_referencia = '2026-06' AND campanha_id IS NULL;
  END IF;

  -- Brasil Atacadista
  IF EXISTS (SELECT 1 FROM cm_acoes_investimento WHERE rede = 'BRASIL ATACADISTA' AND mes_referencia = '2026-06' AND campanha_id IS NULL) THEN
    c_brasil_id := gen_random_uuid();
    INSERT INTO cm_campanhas (id, codigo_campanha, nome_campanha, rede, codigo_matriz, mes_referencia, status_operacional, status_financeiro, gerente_id)
    VALUES (c_brasil_id, 'BRA-202606-AUTO-' || substring(gen_random_uuid()::text from 1 for 8), 'Campanha BRASIL ATACADISTA - 2026-06 - AutoCreated', 'BRASIL ATACADISTA', '155898.0', '2026-06', 'PLANEJAMENTO', 'ABERTA', 'b447f539-4f65-41d3-a113-238c246fcd7f');
    
    UPDATE cm_acoes_investimento SET campanha_id = c_brasil_id WHERE rede = 'BRASIL ATACADISTA' AND mes_referencia = '2026-06' AND campanha_id IS NULL;
  END IF;

  -- Zaffari
  IF EXISTS (SELECT 1 FROM cm_acoes_investimento WHERE rede = 'ZAFFARI' AND mes_referencia = '2026-07' AND campanha_id IS NULL) THEN
    c_zaffari_id := gen_random_uuid();
    INSERT INTO cm_campanhas (id, codigo_campanha, nome_campanha, rede, codigo_matriz, mes_referencia, status_operacional, status_financeiro, gerente_id)
    VALUES (c_zaffari_id, 'ZAF-202607-AUTO-' || substring(gen_random_uuid()::text from 1 for 8), 'Campanha ZAFFARI - 2026-07 - AutoCreated', 'ZAFFARI', '84906.0', '2026-07', 'PLANEJAMENTO', 'ABERTA', 'b447f539-4f65-41d3-a113-238c246fcd7f');
    
    UPDATE cm_acoes_investimento SET campanha_id = c_zaffari_id WHERE rede = 'ZAFFARI' AND mes_referencia = '2026-07' AND campanha_id IS NULL;
  END IF;

  -- Zona Sul
  IF EXISTS (SELECT 1 FROM cm_acoes_investimento WHERE rede = 'ZONA SUL' AND mes_referencia = '2026-07' AND campanha_id IS NULL) THEN
    c_zonasul_id := gen_random_uuid();
    INSERT INTO cm_campanhas (id, codigo_campanha, nome_campanha, rede, codigo_matriz, mes_referencia, status_operacional, status_financeiro, gerente_id)
    VALUES (c_zonasul_id, 'ZON-202607-AUTO-' || substring(gen_random_uuid()::text from 1 for 8), 'Campanha ZONA SUL - 2026-07 - AutoCreated', 'ZONA SUL', '19839.0', '2026-07', 'PLANEJAMENTO', 'ABERTA', 'ebf064e8-45fe-471e-89c8-f9ea6132a811');
    
    UPDATE cm_acoes_investimento SET campanha_id = c_zonasul_id WHERE rede = 'ZONA SUL' AND mes_referencia = '2026-07' AND campanha_id IS NULL;
  END IF;
END $$;

-- 3. Backfill gerente_id for all campaigns
UPDATE cm_campanhas
SET gerente_id = 
  CASE 
    WHEN rede = 'CLIENTE FAKE TESTE' THEN '792d0fb1-c916-4756-97ca-2d32adeb52cd'::uuid -- Agente Teste
    WHEN rede IN ('ASSAI', 'DONA', 'REDE OBA', 'VERDEMAR', 'ZONA SUL', 'HIPERIDEAL', 'REDEMIX', 'SUPER ADEGA', 'SUPERNOSSO') THEN 'ebf064e8-45fe-471e-89c8-f9ea6132a811'::uuid -- Luiz
    WHEN rede IN ('MAMBO', 'SuperVille', 'BOA', 'CONFIANÇA', 'FORT', 'ARMAZEM DA MARIA') THEN 'ea6cc77a-9e0a-48d3-9030-f08243021f1e'::uuid -- Julliano
    WHEN rede IN ('ANGELONI', 'BISTEK', 'BRASIL ATACADISTA', 'FESTVAL', 'IMPERATRIZ', 'ZAFFARI', 'ZAFFARI (CESTO)') THEN 'b447f539-4f65-41d3-a113-238c246fcd7f'::uuid -- Leandro Saffi
    WHEN rede = 'COELHO DINIZ' THEN '77777777-7777-7777-7777-777777777777'::uuid -- Inside Sales
    ELSE '792d0fb1-c916-4756-97ca-2d32adeb52cd'::uuid -- Fallback to Agente Teste
  END
WHERE gerente_id IS NULL;

-- 4. Set NOT NULL constraints
ALTER TABLE cm_campanhas ALTER COLUMN gerente_id SET NOT NULL;
ALTER TABLE cm_acoes_investimento ALTER COLUMN campanha_id SET NOT NULL;

-- 5. Recreate View public.v_acoes_investimento_com_gerente
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
