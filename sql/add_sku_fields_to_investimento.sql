-- Add new fields for SKU and discounts to cm_acoes_investimento table
ALTER TABLE cm_acoes_investimento
ADD COLUMN IF NOT EXISTS desconto_boleto boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS abrangencia text DEFAULT 'Família',
ADD COLUMN IF NOT EXISTS skus_detalhes jsonb DEFAULT '[]'::jsonb;
