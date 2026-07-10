-- Migration: Ajustar Divergência Operacional (Trade Fase 2)
-- Remove as validações físicas das datas reais da constraint (mantendo as colunas data_inicio_real e data_fim_real temporariamente sem uso)
-- Aplicada em: 2026-07-10

-- 1. Remover restrição física antiga
ALTER TABLE cm_acoes_investimento DROP CONSTRAINT IF EXISTS chk_divergencia_calendario;

-- 2. Adicionar nova restrição de dois estados estritos (sem validação de datas reais)
ALTER TABLE cm_acoes_investimento
ADD CONSTRAINT chk_divergencia_calendario
CHECK (
  -- ESTADO A: sem divergência, campos de motivo e observação devem ser nulos
  (
    possui_divergencia_calendario = false
    AND motivo_divergencia_calendario IS NULL
    AND observacao_divergencia        IS NULL
  )
  OR
  -- ESTADO B: com divergência, campos de motivo e observação devem ser preenchidos
  (
    possui_divergencia_calendario = true
    AND motivo_divergencia_calendario IS NOT NULL
    AND observacao_divergencia        IS NOT NULL
  )
);
