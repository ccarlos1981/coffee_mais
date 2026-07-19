-- Migration: 20260719163812_fase4_sprint4.2_saneamento_lote05b.sql
-- Description: Criação de matrizes, workflow de vinculação de filiais e recálculo de qualidade cadastral para o Lote 05B

BEGIN;

-- 1. Criar as novas Matrizes em cm_redes_matrizes
INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro, manager, manager_id)
VALUES 
  ('76191.2', 'BIG LAR', 'Key Account', '76191', 'Luiz', '1001'),
  ('97024.2', 'ARASUPER', 'Key Account', '97024', 'Luiz', '1001'),
  ('22244.2', 'COMERCIAL MONLEVADE', 'Key Account', '22244', 'Luiz', '1001'),
  ('34107.2', 'ORIUNDI SUPERMERCADOS', 'Key Account', '34107', 'Luiz', '1001'),
  ('7264.2', 'PATIO GOURMET', 'Key Account', '7264', 'Luiz', '1001'),
  ('17160.2', 'SUPER LUNA', 'Key Account', '17160', 'Luiz', '1001')
ON CONFLICT (codigo) DO NOTHING;

-- 2. Executar o workflow de solicitação e aprovação para cada filial (Idempotente e Auditado)
DO $$
DECLARE
    v_req_id UUID;
    v_actor UUID := NULL; -- Seta como NULL para uso de Sistema / Script de migração
BEGIN
    -- 2.1. BIG LAR (Cód. 76191) -> Nova UF MT, Nova Matriz 76191.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 76191, 'MT', '76191.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF MT', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.2. ARASUPER (Cód. 97026) -> Nova UF AC, Nova Matriz 97024.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 97026, 'AC', '97024.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF AC', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.3. ARASUPER (Cód. 97025) -> Nova UF AC, Nova Matriz 97024.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 97025, 'AC', '97024.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF AC', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.4. ARASUPER (Cód. 97024) -> Nova UF AC, Nova Matriz 97024.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 97024, 'AC', '97024.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF AC', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.5. COMERCIAL MONLEVADE (Cód. 22244) -> Nova UF MG, Nova Matriz 22244.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 22244, 'MG', '22244.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF MG', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.6. ORIUNDI SUPERMERCADOS (Cód. 34107) -> Nova UF ES, Nova Matriz 34107.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 34107, 'ES', '34107.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF ES', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.7. PATIO GOURMET (Cód. 7264) -> Nova UF AM, Nova Matriz 7264.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 7264, 'AM', '7264.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF AM', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

    -- 2.8. SUPERMERCADO SUPER LUNA S.A (Cód. 17160) -> Nova UF MG, Nova Matriz 17160.2
    v_req_id := gen_random_uuid();
    INSERT INTO public.cm_ownership_requests (id, cliente_codigo, uf_proposta, codigo_matriz_proposto, responsavel_proposto, justificativa, status)
    VALUES (v_req_id, 17160, 'MG', '17160.2', 'Luiz', 'Saneamento Lote 05B - Vinculo de Matriz e UF MG', 'RASCUNHO');
    PERFORM public.transition_ownership_request(v_req_id, 'PENDENTE_APROVACAO', 'Submissão Lote 05B', v_actor);
    PERFORM public.transition_ownership_request(v_req_id, 'APROVADO', 'Aprovação Lote 05B', v_actor);

END $$;

-- 3. Atualização Concorrente Automatizada dos Indicadores e do Snapshots da Fase 3
REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_cadastros_inconsistentes;
SELECT public.take_cadastros_quality_snapshot('manual');

-- 4. Registrar a evolução do schema na tabela de histórico
INSERT INTO public.cm_governance_schema_history (baseline_version, fase, sprint, migration_name)
VALUES ('v1.0.1', 'Fase 4', 'Sprint 4.2', '20260719163812_fase4_sprint4.2_saneamento_lote05b.sql');

COMMIT;
