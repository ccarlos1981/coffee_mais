-- Tabela: Investimento por Cliente
-- Cada linha representa um cliente/rede com dados financeiros de investimento

CREATE TABLE IF NOT EXISTS investimento_cliente (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente TEXT NOT NULL UNIQUE,
  investimento NUMERIC DEFAULT 0,        -- Valor Bruto
  despesas NUMERIC DEFAULT 0,            -- Valor Bruto
  cpv_percentual NUMERIC DEFAULT 0,      -- %
  lucro NUMERIC DEFAULT 0,               -- Valor Bruto
  dga_percentual NUMERIC DEFAULT 0,      -- %
  custo_rede NUMERIC DEFAULT 0,          -- Valor Bruto
  numero_lojas INTEGER DEFAULT 0,
  contrato_percentual NUMERIC DEFAULT 0, -- %
  cpv_custo NUMERIC DEFAULT 0,           -- Valor Bruto
  contrato_frete_icms NUMERIC DEFAULT 0, -- Valor Bruto
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_investimento_cliente_nome ON investimento_cliente(cliente);

-- RLS (disable for now, same pattern as other tables)
ALTER TABLE investimento_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to investimento_cliente"
  ON investimento_cliente FOR ALL
  USING (true)
  WITH CHECK (true);
