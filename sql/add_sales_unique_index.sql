-- Índice UNIQUE para evitar duplicatas na importação de vendas
-- Usa combinação de data + nota + produto como chave de deduplicação
-- COALESCE garante que NULLs não quebrem a constraint

-- Remove índice antigo se existir (idempotente)
DROP INDEX IF EXISTS idx_sales_unique_row;

-- Cria índice UNIQUE composto
CREATE UNIQUE INDEX idx_sales_unique_row
ON public.sales (
  invoice_date,
  COALESCE(invoice_number, ''),
  COALESCE(unique_number, ''),
  COALESCE(product, ''),
  COALESCE(net_value::text, '0')
);

-- Nota: Após rodar este SQL, o import usará UPSERT com ON CONFLICT DO NOTHING.
-- Registros duplicados serão automaticamente ignorados.
