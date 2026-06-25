-- =========================================================================
-- MÓDULO PROMOTOR - COFFEE MAIS - FASE 3 (COMMAND CENTER OPERACIONAL)
-- SCRIPT DE AJUSTE SPRINT 3.2: ORDEM DE ROTA PLANEJADA
-- =========================================================================

-- 1. Adicionar coluna ordem_rota na tabela de visitas
ALTER TABLE public.cm_promotor_visita 
ADD COLUMN IF NOT EXISTS ordem_rota INT DEFAULT 1;

-- Comentário da coluna para documentação
COMMENT ON COLUMN public.cm_promotor_visita.ordem_rota IS 'Ordem explícita de visitação do PDV planejada para a rota do dia.';
