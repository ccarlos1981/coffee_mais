-- =============================================================================
-- Migration Oficial: Reorganização Estrutural Comercial (John Guedes)
-- data: 2026-08-04
--
-- Reorganização da responsabilidade regional dos estados:
-- DF, GO, MS, MT, TO, AM, PA -> John Guedes (employee_code / manager_id: '1003')
-- =============================================================================

BEGIN;

-- 1. Garantir perfil do Gerente Regional John Guedes em cm_user_profiles
INSERT INTO public.cm_user_profiles (
  id,
  name,
  role,
  approved,
  employee_code,
  manager_name,
  default_variavel_mensal,
  receber_pdf_vendas,
  receber_pdf_investimento,
  created_at,
  updated_at
)
VALUES (
  'e6037a3b-2856-42f8-9a4f-7f2a1b9c4033',
  'John Guedes',
  'Gerente Regional',
  TRUE,
  '1003',
  'John Guedes',
  0,
  FALSE,
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = 'John Guedes',
  role = 'Gerente Regional',
  approved = TRUE,
  employee_code = '1003',
  manager_name = 'John Guedes',
  updated_at = NOW();

-- 2. Atualizar Mapeamento Territorial Oficial (manager_uf_mapping)
INSERT INTO public.manager_uf_mapping (uf, manager, updated_at)
VALUES 
  ('DF', 'John Guedes', NOW()),
  ('GO', 'John Guedes', NOW()),
  ('MS', 'John Guedes', NOW()),
  ('MT', 'John Guedes', NOW()),
  ('TO', 'John Guedes', NOW()),
  ('AM', 'John Guedes', NOW()),
  ('PA', 'John Guedes', NOW())
ON CONFLICT (uf) DO UPDATE SET
  manager = 'John Guedes',
  updated_at = NOW();

-- 3. Atualizar Responsável Comercial dos Clientes em cm_clientes
UPDATE public.cm_clientes
SET 
  responsavel = 'John Guedes',
  manager_name = 'John Guedes',
  manager_id = '1003',
  regional = 'John Guedes'
WHERE uf IN ('DF', 'GO', 'MS', 'MT', 'TO', 'AM', 'PA');

-- 4. Atualizar Base de Atendimento (base_atendimento)
UPDATE public.base_atendimento
SET 
  manager = 'John Guedes',
  manager_id = '1003',
  regional = 'John Guedes'
WHERE uf IN ('DF', 'GO', 'MS', 'MT', 'TO', 'AM', 'PA');

-- 5. Atualizar cm_redes_matrizes para redes pertencentes às regiões de John Guedes
UPDATE public.cm_redes_matrizes rm
SET 
  manager = 'John Guedes',
  manager_id = '1003',
  updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM public.cm_clientes c
  WHERE c.codigo_matriz = rm.codigo
    AND c.uf IN ('DF', 'GO', 'MS', 'MT', 'TO', 'AM', 'PA')
);

-- 6. Atualizar Projeções Semanais (cm_weekly_projections) para redes dos estados do John Guedes
UPDATE public.cm_weekly_projections wp
SET 
  manager = 'John Guedes',
  manager_id = '1003',
  updated_at = NOW()
WHERE client_matrix IN (
  SELECT DISTINCT c.matriz
  FROM public.cm_clientes c
  WHERE c.uf IN ('DF', 'GO', 'MS', 'MT', 'TO', 'AM', 'PA')
    AND c.matriz IS NOT NULL
);

COMMIT;
