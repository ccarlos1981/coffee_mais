-- Upgrade na tabela cm_boletos para comportar os novos campos da planilha do Módulo Trade

ALTER TABLE public.cm_boletos
ADD COLUMN IF NOT EXISTS nro_nota TEXT,
ADD COLUMN IF NOT EXISTS parceiro_codigo TEXT,
ADD COLUMN IF NOT EXISTS valor_desdobramento NUMERIC,
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC,
ADD COLUMN IF NOT EXISTS abatimento NUMERIC,
ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC,
ADD COLUMN IF NOT EXISTS tipo_titulo TEXT,
ADD COLUMN IF NOT EXISTS historico TEXT,
ADD COLUMN IF NOT EXISTS tipo_operacao TEXT,
ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT,
ADD COLUMN IF NOT EXISTS data_negociacao DATE,
ADD COLUMN IF NOT EXISTS empresa TEXT;

-- Garantir que a RLS (se ativa) permita update/insert com os novos campos (já coberto se a política for USING (true))
