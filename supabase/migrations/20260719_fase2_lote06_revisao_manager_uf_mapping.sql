-- Migration: 20260719_fase2_lote06_revisao_manager_uf_mapping.sql
-- Description: Update default managers in manager_uf_mapping and propagate updates to cm_clientes using central logic.

BEGIN;

-- 1. UPDATE DA TABELA DE CONFIGURAÇÃO (MAPS)
UPDATE public.manager_uf_mapping
SET manager = CASE 
    WHEN uf = 'SP' THEN 'Julliano'
    WHEN uf IN ('PR', 'RS', 'SC') THEN 'Leandro Saffi'
    ELSE 'Luiz'
  END
WHERE uf IN ('SP', 'RS', 'SC', 'PR', 'MG', 'RJ', 'BA', 'DF', 'GO', 'PE', 'ES', 'MA', 'PI');

-- 2. PROPAGAÇÃO DO CÁLCULO CENTRALIZADO PARA OS CLIENTES
-- Atualiza apenas os registros onde o resultado calculado pela SSOT é diferente do atual
UPDATE public.cm_clientes c
SET responsavel = public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel)
WHERE c.uf IN ('SP', 'RS', 'SC', 'PR', 'MG', 'RJ', 'BA', 'DF', 'GO', 'PE', 'ES', 'MA', 'PI')
  AND c.responsavel IS DISTINCT FROM public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel);

COMMIT;
