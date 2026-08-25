-- ==============================================================================
-- MIGRATION: 20260825_canonicalize_all_networks_systemic.sql
-- OBJETIVO: Saneamento sistêmico e consolidação de redes canônicas (P4.11)
-- REGRA DE SEGURANÇA: Resolução determinística estrita (SUCCESS), preservação de AMBIGUA
-- ==============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. CONSOLIDAÇÃO E SANEAMENTO EM cm_weekly_projections
-- -----------------------------------------------------------------------------

-- JULLIANO: FORT -> FORT (SP)
-- A) Limpar linhas com projection_value = 0 em FORT (SP) onde FORT possui valor real
DELETE FROM public.cm_weekly_projections p_target
USING public.cm_weekly_projections p_src
WHERE p_target.manager = 'Julliano'
  AND p_target.client_matrix = 'FORT (SP)'
  AND p_src.manager = 'Julliano'
  AND p_src.client_matrix = 'FORT'
  AND p_target.year = p_src.year
  AND p_target.month = p_src.month
  AND p_target.week_start_date = p_src.week_start_date
  AND p_target.kpi = p_src.kpi
  AND p_target.projection_value = 0
  AND p_src.projection_value > 0;

-- B) Limpar linhas de FORT com projection_value = 0 onde FORT (SP) possui valor real
DELETE FROM public.cm_weekly_projections p_src
USING public.cm_weekly_projections p_target
WHERE p_src.manager = 'Julliano'
  AND p_src.client_matrix = 'FORT'
  AND p_target.manager = 'Julliano'
  AND p_target.client_matrix = 'FORT (SP)'
  AND p_src.year = p_target.year
  AND p_src.month = p_target.month
  AND p_src.week_start_date = p_target.week_start_date
  AND p_src.kpi = p_target.kpi
  AND p_src.projection_value = 0
  AND p_target.projection_value > 0;

-- C) Migrar registros remanescentes de FORT para FORT (SP)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'FORT (SP)',
  codigo_matriz = '95580.0',
  updated_at = NOW()
WHERE manager = 'Julliano'
  AND client_matrix = 'FORT'
  AND NOT EXISTS (
    SELECT 1 FROM public.cm_weekly_projections p2
    WHERE p2.manager = 'Julliano'
      AND p2.client_matrix = 'FORT (SP)'
      AND p2.year = cm_weekly_projections.year
      AND p2.month = cm_weekly_projections.month
      AND p2.week_start_date = cm_weekly_projections.week_start_date
      AND p2.kpi = cm_weekly_projections.kpi
  );

-- JULLIANO: ZAFFARI -> ZAFFARI (SP)
-- A) Limpar linhas com projection_value = 0 em ZAFFARI (SP) onde ZAFFARI possui valor real
DELETE FROM public.cm_weekly_projections p_target
USING public.cm_weekly_projections p_src
WHERE p_target.manager = 'Julliano'
  AND p_target.client_matrix = 'ZAFFARI (SP)'
  AND p_src.manager = 'Julliano'
  AND p_src.client_matrix = 'ZAFFARI'
  AND p_target.year = p_src.year
  AND p_target.month = p_src.month
  AND p_target.week_start_date = p_src.week_start_date
  AND p_target.kpi = p_src.kpi
  AND p_target.projection_value = 0
  AND p_src.projection_value > 0;

-- B) Limpar linhas de ZAFFARI com projection_value = 0 onde ZAFFARI (SP) possui valor real
DELETE FROM public.cm_weekly_projections p_src
USING public.cm_weekly_projections p_target
WHERE p_src.manager = 'Julliano'
  AND p_src.client_matrix = 'ZAFFARI'
  AND p_target.manager = 'Julliano'
  AND p_target.client_matrix = 'ZAFFARI (SP)'
  AND p_src.year = p_target.year
  AND p_src.month = p_target.month
  AND p_src.week_start_date = p_target.week_start_date
  AND p_src.kpi = p_target.kpi
  AND p_src.projection_value = 0
  AND p_target.projection_value > 0;

-- C) Migrar registros remanescentes de ZAFFARI para ZAFFARI (SP)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'ZAFFARI (SP)',
  codigo_matriz = '84906.0',
  updated_at = NOW()
WHERE manager = 'Julliano'
  AND client_matrix = 'ZAFFARI'
  AND NOT EXISTS (
    SELECT 1 FROM public.cm_weekly_projections p2
    WHERE p2.manager = 'Julliano'
      AND p2.client_matrix = 'ZAFFARI (SP)'
      AND p2.year = cm_weekly_projections.year
      AND p2.month = cm_weekly_projections.month
      AND p2.week_start_date = cm_weekly_projections.week_start_date
      AND p2.kpi = cm_weekly_projections.kpi
  );

-- LEANDRO SAFFI: FORT -> FORT (SC)
-- A) Limpar linhas com projection_value = 0 em FORT (SC) onde FORT possui valor real
DELETE FROM public.cm_weekly_projections p_target
USING public.cm_weekly_projections p_src
WHERE p_target.manager = 'Leandro Saffi'
  AND p_target.client_matrix = 'FORT (SC)'
  AND p_src.manager = 'Leandro Saffi'
  AND p_src.client_matrix = 'FORT'
  AND p_target.year = p_src.year
  AND p_target.month = p_src.month
  AND p_target.week_start_date = p_src.week_start_date
  AND p_target.kpi = p_src.kpi
  AND p_target.projection_value = 0
  AND p_src.projection_value > 0;

-- B) Migrar registros de FORT para FORT (SC)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'FORT (SC)',
  codigo_matriz = '95580.0',
  updated_at = NOW()
WHERE manager = 'Leandro Saffi'
  AND client_matrix = 'FORT'
  AND NOT EXISTS (
    SELECT 1 FROM public.cm_weekly_projections p2
    WHERE p2.manager = 'Leandro Saffi'
      AND p2.client_matrix = 'FORT (SC)'
      AND p2.year = cm_weekly_projections.year
      AND p2.month = cm_weekly_projections.month
      AND p2.week_start_date = cm_weekly_projections.week_start_date
      AND p2.kpi = cm_weekly_projections.kpi
  );

-- LEANDRO SAFFI: FESTVAL -> FESTVAL (SC)
-- A) Limpar linhas com projection_value = 0 em FESTVAL (SC) onde FESTVAL possui valor real
DELETE FROM public.cm_weekly_projections p_target
USING public.cm_weekly_projections p_src
WHERE p_target.manager = 'Leandro Saffi'
  AND p_target.client_matrix = 'FESTVAL (SC)'
  AND p_src.manager = 'Leandro Saffi'
  AND p_src.client_matrix = 'FESTVAL'
  AND p_target.year = p_src.year
  AND p_target.month = p_src.month
  AND p_target.week_start_date = p_src.week_start_date
  AND p_target.kpi = p_src.kpi
  AND p_target.projection_value = 0
  AND p_src.projection_value > 0;

-- B) Migrar registros de FESTVAL para FESTVAL (SC)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'FESTVAL (SC)',
  codigo_matriz = '27068.0',
  updated_at = NOW()
WHERE manager = 'Leandro Saffi'
  AND client_matrix = 'FESTVAL'
  AND NOT EXISTS (
    SELECT 1 FROM public.cm_weekly_projections p2
    WHERE p2.manager = 'Leandro Saffi'
      AND p2.client_matrix = 'FESTVAL (SC)'
      AND p2.year = cm_weekly_projections.year
      AND p2.month = cm_weekly_projections.month
      AND p2.week_start_date = cm_weekly_projections.week_start_date
      AND p2.kpi = cm_weekly_projections.kpi
  );

-- -----------------------------------------------------------------------------
-- 2. SANEAMENTO EM cm_rps_custom_carteira
-- -----------------------------------------------------------------------------

-- Julliano: Remover FORT legado se FORT (SP) já existe
DELETE FROM public.cm_rps_custom_carteira
WHERE manager = 'Julliano'
  AND client_matrix = 'FORT'
  AND EXISTS (
    SELECT 1 FROM public.cm_rps_custom_carteira c2
    WHERE c2.manager = 'Julliano'
      AND c2.client_matrix = 'FORT (SP)'
      AND c2.year = cm_rps_custom_carteira.year
      AND c2.month = cm_rps_custom_carteira.month
  );

-- Julliano: Atualizar FORT restante para FORT (SP)
UPDATE public.cm_rps_custom_carteira
SET client_matrix = 'FORT (SP)', updated_at = NOW()
WHERE manager = 'Julliano' AND client_matrix = 'FORT';

-- Julliano: Remover ZAFFARI legado se ZAFFARI (SP) já existe
DELETE FROM public.cm_rps_custom_carteira
WHERE manager = 'Julliano'
  AND client_matrix = 'ZAFFARI'
  AND EXISTS (
    SELECT 1 FROM public.cm_rps_custom_carteira c2
    WHERE c2.manager = 'Julliano'
      AND c2.client_matrix = 'ZAFFARI (SP)'
      AND c2.year = cm_rps_custom_carteira.year
      AND c2.month = cm_rps_custom_carteira.month
  );

-- Julliano: Atualizar ZAFFARI restante para ZAFFARI (SP)
UPDATE public.cm_rps_custom_carteira
SET client_matrix = 'ZAFFARI (SP)', updated_at = NOW()
WHERE manager = 'Julliano' AND client_matrix = 'ZAFFARI';

-- Leandro Saffi: Remover FORT legado se FORT (SC) já existe
DELETE FROM public.cm_rps_custom_carteira
WHERE manager = 'Leandro Saffi'
  AND client_matrix = 'FORT'
  AND EXISTS (
    SELECT 1 FROM public.cm_rps_custom_carteira c2
    WHERE c2.manager = 'Leandro Saffi'
      AND c2.client_matrix = 'FORT (SC)'
      AND c2.year = cm_rps_custom_carteira.year
      AND c2.month = cm_rps_custom_carteira.month
  );

-- Leandro Saffi: Atualizar FORT restante para FORT (SC)
UPDATE public.cm_rps_custom_carteira
SET client_matrix = 'FORT (SC)', updated_at = NOW()
WHERE manager = 'Leandro Saffi' AND client_matrix = 'FORT';

-- Leandro Saffi: Remover FESTVAL legado se FESTVAL (SC) já existe
DELETE FROM public.cm_rps_custom_carteira
WHERE manager = 'Leandro Saffi'
  AND client_matrix = 'FESTVAL'
  AND EXISTS (
    SELECT 1 FROM public.cm_rps_custom_carteira c2
    WHERE c2.manager = 'Leandro Saffi'
      AND c2.client_matrix = 'FESTVAL (SC)'
      AND c2.year = cm_rps_custom_carteira.year
      AND c2.month = cm_rps_custom_carteira.month
  );

-- Leandro Saffi: Atualizar FESTVAL restante para FESTVAL (SC)
UPDATE public.cm_rps_custom_carteira
SET client_matrix = 'FESTVAL (SC)', updated_at = NOW()
WHERE manager = 'Leandro Saffi' AND client_matrix = 'FESTVAL';

-- -----------------------------------------------------------------------------
-- 3. SINCRONIZAÇÃO EM cm_redes_matrizes
-- -----------------------------------------------------------------------------
INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, manager_id, manager, updated_at)
VALUES
  ('95580.0', 'FORT (SP)', 'KA', '1000', 'Julliano', NOW()),
  ('95580.1', 'FORT (SC)', 'KA', '1001', 'Leandro Saffi', NOW()),
  ('84906.0', 'ZAFFARI (SP)', 'KA', '1000', 'Julliano', NOW()),
  ('84906.1', 'ZAFFARI (RS)', 'KA', '1001', 'Leandro Saffi', NOW()),
  ('84906.2', 'ZAFFARI (CESTO)', 'KA', '1001', 'Leandro Saffi', NOW()),
  ('27068.0', 'FESTVAL (SC)', 'KA', '1001', 'Leandro Saffi', NOW())
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  manager_id = EXCLUDED.manager_id,
  manager = EXCLUDED.manager,
  updated_at = NOW();

COMMIT;
