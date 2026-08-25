-- =============================================================================
-- Migration Oficial: Correção do Typo de Gerente Territorial do Acre (AC)
-- Data: 2026-08-25
-- Escopo: public.manager_uf_mapping (AC: 'Luisa' -> 'Luiz')
-- =============================================================================

DO $$
DECLARE
  v_count INT;
BEGIN
  -- 1. Guard Obrigatório: Validar que existe exatamente 1 registro de AC com 'Luisa'
  SELECT count(*) INTO v_count
  FROM public.manager_uf_mapping
  WHERE uf = 'AC' AND manager = 'Luisa';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Abortando migração: registro esperado (uf = AC, manager = Luisa) não encontrado ou duplicado (count: %)', v_count;
  END IF;

  -- 2. Atualizar para o gerente oficial Luiz
  UPDATE public.manager_uf_mapping
  SET manager = 'Luiz',
      updated_at = NOW()
  WHERE uf = 'AC' AND manager = 'Luisa';

  RAISE NOTICE 'Mapeamento territorial do Acre (AC) corrigido com sucesso para Luiz.';
END $$;
