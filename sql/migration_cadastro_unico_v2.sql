-- Alter table columns for cm_clientes
ALTER TABLE cm_clientes 
ADD COLUMN IF NOT EXISTS codigo_matriz TEXT,
ADD COLUMN IF NOT EXISTS responsavel TEXT,
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS regional TEXT,
ADD COLUMN IF NOT EXISTS ka TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

-- Migrate data from base_atendimento to cm_clientes
INSERT INTO cm_clientes (codigo, cnpj, nome_parceiro, razao_social, matriz, tipo_parceiro, responsavel, uf, regional, ka, status)
SELECT 
  cod_parceiro::integer,
  cnpj,
  nome_parceiro,
  nome_parceiro,
  rede,
  canal,
  manager,
  uf,
  regional,
  ka,
  'ativo'
FROM base_atendimento
ON CONFLICT (codigo) DO UPDATE 
SET 
  cnpj = COALESCE(cm_clientes.cnpj, EXCLUDED.cnpj),
  nome_parceiro = COALESCE(cm_clientes.nome_parceiro, EXCLUDED.nome_parceiro),
  razao_social = COALESCE(cm_clientes.razao_social, EXCLUDED.razao_social),
  matriz = COALESCE(cm_clientes.matriz, EXCLUDED.matriz),
  tipo_parceiro = COALESCE(cm_clientes.tipo_parceiro, EXCLUDED.tipo_parceiro),
  responsavel = COALESCE(cm_clientes.responsavel, EXCLUDED.responsavel),
  uf = COALESCE(cm_clientes.uf, EXCLUDED.uf),
  regional = COALESCE(cm_clientes.regional, EXCLUDED.regional),
  ka = COALESCE(cm_clientes.ka, EXCLUDED.ka),
  status = EXCLUDED.status;
