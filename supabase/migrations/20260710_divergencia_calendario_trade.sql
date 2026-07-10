-- Migration: Divergência Operacional de Calendário (Trade Fase 2)
-- Aplicada em: 2026-07-10
-- Projeto: Coffee Mais (ncncazbhpoxjlyvcbvqa)

-- 1. Criar enum controlado para motivo
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_divergencia_enum') THEN
    CREATE TYPE motivo_divergencia_enum AS ENUM (
      'ATRASO_LOGISTICO',
      'ALTERACAO_REDE',
      'ALTERACAO_COMERCIAL',
      'PROBLEMA_OPERACIONAL_LOJA',
      'RUPTURA_ESTOQUE',
      'ALTERACAO_ENCARTE',
      'OUTROS'
    );
  END IF;
END $$;

-- 2. Adicionar colunas em cm_acoes_investimento
ALTER TABLE cm_acoes_investimento
  ADD COLUMN IF NOT EXISTS possui_divergencia_calendario  BOOLEAN                    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_inicio_real               DATE                       NULL,
  ADD COLUMN IF NOT EXISTS data_fim_real                  DATE                       NULL,
  ADD COLUMN IF NOT EXISTS motivo_divergencia_calendario  motivo_divergencia_enum    NULL,
  ADD COLUMN IF NOT EXISTS observacao_divergencia         TEXT                       NULL;

-- 3. Constraint de integridade física (dois estados estritos)
-- Rollback: ALTER TABLE cm_acoes_investimento DROP CONSTRAINT chk_divergencia_calendario;
ALTER TABLE cm_acoes_investimento
  DROP CONSTRAINT IF EXISTS chk_divergencia_calendario;

ALTER TABLE cm_acoes_investimento
ADD CONSTRAINT chk_divergencia_calendario
CHECK (
  -- ESTADO A: sem divergência, todos os campos nulos
  (
    possui_divergencia_calendario = false
    AND data_inicio_real              IS NULL
    AND data_fim_real                 IS NULL
    AND motivo_divergencia_calendario IS NULL
    AND observacao_divergencia        IS NULL
  )
  OR
  -- ESTADO B: com divergência, todos os campos preenchidos e datas válidas
  (
    possui_divergencia_calendario = true
    AND data_inicio_real              IS NOT NULL
    AND data_fim_real                 IS NOT NULL
    AND motivo_divergencia_calendario IS NOT NULL
    AND observacao_divergencia        IS NOT NULL
    AND data_inicio_real             <= data_fim_real
  )
);

-- Rollback completo:
-- ALTER TABLE cm_acoes_investimento DROP CONSTRAINT IF EXISTS chk_divergencia_calendario;
-- ALTER TABLE cm_acoes_investimento DROP COLUMN IF EXISTS observacao_divergencia;
-- ALTER TABLE cm_acoes_investimento DROP COLUMN IF EXISTS motivo_divergencia_calendario;
-- ALTER TABLE cm_acoes_investimento DROP COLUMN IF EXISTS data_fim_real;
-- ALTER TABLE cm_acoes_investimento DROP COLUMN IF EXISTS data_inicio_real;
-- ALTER TABLE cm_acoes_investimento DROP COLUMN IF EXISTS possui_divergencia_calendario;
-- DROP TYPE IF EXISTS motivo_divergencia_enum;
