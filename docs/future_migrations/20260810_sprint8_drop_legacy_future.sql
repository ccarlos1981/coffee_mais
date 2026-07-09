-- Future Migration: DROP Definitivo das Estruturas Legadas do Módulo de Investimentos
-- Esta migration deve ser executada apenas após 30 dias de estabilização pós-Go-Live.

BEGIN;

-- 1. Remover as tabelas legadas
DROP TABLE IF EXISTS public.cm_investimento_familias_history CASCADE;
DROP TABLE IF EXISTS public.cm_investimento_familias CASCADE;

-- 2. Remover as colunas obsoletas da tabela cm_acoes_investimento
ALTER TABLE public.cm_acoes_investimento
DROP COLUMN IF EXISTS familias_detalhes,
DROP COLUMN IF EXISTS skus_detalhes;

COMMIT;
