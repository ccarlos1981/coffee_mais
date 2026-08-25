-- ==============================================================================
-- Migration: Persistência Estruturada do GAP Original em Follow-up Actions (P3.6B)
-- Data: 24/08/2026
-- Objetivo: Adicionar coluna NUMERIC para armazenar o valor monetário do Gap original
--           gerado por compromissos da RPS (RPS_COMPROMISSO), permitindo reconciliação
--           financeira exata e auditável sem parsing de texto livre.
-- ==============================================================================

ALTER TABLE public.cm_follow_up_actions 
ADD COLUMN IF NOT EXISTS gap_original_reais NUMERIC NULL;

COMMENT ON COLUMN public.cm_follow_up_actions.gap_original_reais IS 
'Valor monetário absoluto do gap financeiro original (R$) apurado no momento da criação do compromisso na RPS. Nullable para ações manuais, CRM ou sem gap financeiro.';
