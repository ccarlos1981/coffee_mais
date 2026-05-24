-- Adicionar campos de controle de fase e dossiê ao cm_acoes_investimento
-- Fluxo: 1=Planejamento → 2=Trade → 3=Apuração → 4=Conferência → 5=Financeiro → 6=Concluído

ALTER TABLE cm_acoes_investimento
  -- Controle de fase
  ADD COLUMN IF NOT EXISTS fase_atual integer DEFAULT 1,
  
  -- Fase 2: Trade Validação
  ADD COLUMN IF NOT EXISTS trade_validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS trade_validado_por text,
  
  -- Fase 3: Apuração Comercial (Dossiê)
  ADD COLUMN IF NOT EXISTS numero_acordo text,
  ADD COLUMN IF NOT EXISTS evidencias_urls jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS volume_vendido_sellout numeric,
  ADD COLUMN IF NOT EXISTS vencimento date,
  ADD COLUMN IF NOT EXISTS dados_quitacao text,
  ADD COLUMN IF NOT EXISTS apuracao_preenchida_em timestamptz,
  ADD COLUMN IF NOT EXISTS apuracao_preenchida_por text,
  
  -- Fase 4: Trade Conferência
  ADD COLUMN IF NOT EXISTS trade_conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS trade_conferido_por text,
  ADD COLUMN IF NOT EXISTS trade_conferencia_aprovado boolean,
  ADD COLUMN IF NOT EXISTS trade_conferencia_observacao text,
  
  -- Fase 5: Financeiro
  ADD COLUMN IF NOT EXISTS financeiro_pago_em timestamptz,
  ADD COLUMN IF NOT EXISTS financeiro_pago_por text,
  ADD COLUMN IF NOT EXISTS financeiro_comprovante_url text,
  ADD COLUMN IF NOT EXISTS financeiro_observacoes text;

-- Index para filtrar por fase
CREATE INDEX IF NOT EXISTS idx_cm_acoes_fase ON cm_acoes_investimento(fase_atual);
