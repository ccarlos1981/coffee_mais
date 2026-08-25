-- Migration: Canonicalização dos Nomes de Redes na RPS (REDE OBA -> REDE OBA SP / REDE OBA DF)
-- Data: 2026-08-25
-- Ref: P4.9 — IMPLEMENTAÇÃO CIRÚRGICA DA CANONICALIZAÇÃO DE NOMES DE REDES NA RPS
-- Baselines Preservadas: AnalyticsEngine V1 (LOCKED), Baseline 57 (LOCKED), RPS P3.6N/P4.7 (LOCKED)

BEGIN;

-- 1. Atualizar Projeções Semanais (cm_weekly_projections) para Julliano (SP)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'REDE OBA SP',
  codigo_matriz = '68216.0',
  updated_at = NOW()
WHERE client_matrix = 'REDE OBA'
  AND manager = 'Julliano';

-- 2. Atualizar Projeções Semanais (cm_weekly_projections) para John Guedes e histórico anterior de Luiz (DF)
UPDATE public.cm_weekly_projections
SET 
  client_matrix = 'REDE OBA DF',
  codigo_matriz = '68216.0',
  updated_at = NOW()
WHERE client_matrix = 'REDE OBA'
  AND manager IN ('John Guedes', 'Luiz');

-- 3. Atualizar Carteira Customizada da RPS (cm_rps_custom_carteira) para Julliano (SP)
UPDATE public.cm_rps_custom_carteira
SET 
  client_matrix = 'REDE OBA SP',
  updated_at = NOW()
WHERE client_matrix = 'REDE OBA'
  AND manager = 'Julliano';

-- 4. Atualizar Carteira Customizada da RPS (cm_rps_custom_carteira) para John Guedes e Luiz (DF)
UPDATE public.cm_rps_custom_carteira
SET 
  client_matrix = 'REDE OBA DF',
  updated_at = NOW()
WHERE client_matrix = 'REDE OBA'
  AND manager IN ('John Guedes', 'Luiz');

-- 5. Sincronizar Cadastro Mestre de Redes (cm_redes_matrizes)
-- 5.1 Garantir REDE OBA SP para Julliano (SP) com código base 68216.0
INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro, manager_id, manager, updated_at)
VALUES ('68216.0', 'REDE OBA SP', 'KA', '68216', '1000', 'Julliano', NOW())
ON CONFLICT (codigo) DO UPDATE
SET 
  nome = 'REDE OBA SP',
  canal = 'KA',
  min_cod_parceiro = '68216',
  manager_id = '1000',
  manager = 'Julliano',
  updated_at = NOW();

-- 5.2 Garantir REDE OBA DF para John Guedes (DF) com código derivado 68216.1 (Seção 7 AGENTS.md)
INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro, manager_id, manager, updated_at)
VALUES ('68216.1', 'REDE OBA DF', 'KA', '71213', '1003', 'John Guedes', NOW())
ON CONFLICT (codigo) DO UPDATE
SET 
  nome = 'REDE OBA DF',
  canal = 'KA',
  min_cod_parceiro = '71213',
  manager_id = '1003',
  manager = 'John Guedes',
  updated_at = NOW();

-- 6. Garantir atualização também em network_matrix de compatibilidade (PDVs)
INSERT INTO public.network_matrix (id, network, network_uf, manager, manager_id, created_at)
VALUES (68216, 'REDE OBA SP', 'SP', 'Julliano', '1000', NOW())
ON CONFLICT (id) DO UPDATE
SET network = 'REDE OBA SP', network_uf = 'SP', manager = 'Julliano', manager_id = '1000';

INSERT INTO public.network_matrix (id, network, network_uf, manager, manager_id, created_at)
VALUES (71213, 'REDE OBA DF', 'DF', 'John Guedes', '1003', NOW())
ON CONFLICT (id) DO UPDATE
SET network = 'REDE OBA DF', network_uf = 'DF', manager = 'John Guedes', manager_id = '1003';

COMMIT;
