-- ============================================================
-- 🚀 MIGRATION: B.7 — APOSENTADORIA DE TABELAS DE SNAPSHOT DESCARTÁVEIS
-- ============================================================
-- Data: 29/08/2026
-- Objetivo: Remover exclusivamente as 3 tabelas de snapshot temporário de migração
--           homologadas nas fases B.7.1 e B.7.2.
--
-- Tabelas Alvo:
--   1. public.cm_acoes_investimento_migradas_backup (Snapshot Sprint 3 de 10/07/2026)
--   2. public.cm_investimento_familias_migradas_backup (Snapshot Sprint 3 de 10/07/2026)
--   3. public.cm_clientes_backup_20260719 (Snapshot Sprint 4.1 de 19/07/2026)
--
-- PRESERVAÇÕES MANDATÓRIAS (NÃO ALTERAR):
--   - public.ceo_targets (Em observação até 30/09/2026)
--   - public.cm_investimento_familias (Bloqueada por Baseline 5)
--   - public.cm_investimento_familias_history (Bloqueada por Baseline 5)
--   - public.cm_clientes, public.cm_acoes_investimento, public.cm_campanhas
-- ============================================================

BEGIN;

-- 1. Remoção das políticas RLS associadas
DROP POLICY IF EXISTS "cm_backup_inv_select_auth" ON public.cm_acoes_investimento_migradas_backup;
DROP POLICY IF EXISTS "cm_backup_inv_fam_select_auth" ON public.cm_investimento_familias_migradas_backup;
DROP POLICY IF EXISTS "cm_backup_tables_select_auth" ON public.cm_clientes_backup_20260719;

-- 2. DROP físico seguro das tabelas de snapshot temporário (sem CASCADE em outros objetos)
DROP TABLE IF EXISTS public.cm_acoes_investimento_migradas_backup;
DROP TABLE IF EXISTS public.cm_investimento_familias_migradas_backup;
DROP TABLE IF EXISTS public.cm_clientes_backup_20260719;

COMMIT;
