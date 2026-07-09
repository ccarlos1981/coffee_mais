-- Migration para Sprint 6: Decomissionamento de Triggers e Congelamento de Tabelas Legadas

BEGIN;

-- 1. Remover Triggers de Sincronização Legadas
DROP TRIGGER IF EXISTS trg_sync_insert_parent_to_child ON public.cm_acoes_investimento;
DROP TRIGGER IF EXISTS trg_sync_child_to_parent_legacy ON public.cm_investimento_familias;
DROP TRIGGER IF EXISTS trg_sync_checklists_to_parent_legacy ON public.cm_investimento_familias;

-- 2. Remover Funções de Sincronização Legadas
DROP FUNCTION IF EXISTS public.sync_insert_parent_to_child();
DROP FUNCTION IF EXISTS public.sync_child_to_parent_legacy();
DROP FUNCTION IF EXISTS public.sync_checklists_to_parent_legacy();

-- 3. Congelamento do Legado: Transformar tabelas em somente-leitura para usuários e funções da aplicação
REVOKE INSERT, UPDATE, DELETE ON public.cm_investimento_familias FROM authenticated, anon, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.cm_investimento_familias_history FROM authenticated, anon, service_role;

-- 4. Garantir que privilégios de SELECT continuem ativos para auditoria histórica
GRANT SELECT ON public.cm_investimento_familias TO authenticated, service_role;
GRANT SELECT ON public.cm_investimento_familias_history TO authenticated, service_role;

COMMIT;
