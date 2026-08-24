-- =============================================================================
-- Migration: 20260824_p0_1_hierarchical_ownership_governance.sql
-- Goal: P0-1 — Governança Definitiva de Ownership Hierárquico Seguro
--
-- REGRAS MANDATÓRIAS:
-- 1. Rede -> Lojas: Quando o titular de cm_redes_matrizes for alterado,
--    todas as lojas em cm_clientes vinculadas à rede que NÃO possuam
--    exceção regional (cm_base_atendimento_regional ou cm_regras_apuracao_comercial)
--    devem herdar o novo gerente da rede.
-- 2. Loja -> Rede: Quando uma única loja em cm_clientes for alterada,
--    o titular de cm_redes_matrizes NÃO pode ser sobrescrito (preserva a titularidade
--    e as exceções regionais).
-- 3. Proteção contra loops: Controle estrito com IS DISTINCT FROM e checagens
--    de existência de regras regionais.
--
-- ROLLBACK:
-- Executar bloco DOWN comentado no final deste arquivo.
-- =============================================================================

BEGIN;

-- 1. REAJUSTE SEGURO DA TRIGGER FUNCTION cm_clientes -> cm_redes_matrizes
-- Garante que lojas individuais NÃO sobrescrevam cegamente o gerente do cabeçalho da rede
CREATE OR REPLACE FUNCTION public.sync_cm_clientes_to_redes_matrizes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_matriz IS NOT NULL AND NEW.matriz IS NOT NULL THEN
    INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro, manager_id, manager)
    VALUES (
      NEW.codigo_matriz,
      NEW.matriz,
      COALESCE(NULLIF(NEW.tipo_parceiro, ''), 'Outros'),
      NEW.codigo::text,
      NEW.manager_id,
      NEW.manager_name
    )
    ON CONFLICT (codigo) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      canal = COALESCE(NULLIF(EXCLUDED.canal, ''), public.cm_redes_matrizes.canal),
      -- PRESERVAÇÃO HIERÁRQUICA: Não sobrescreve o gerente da rede se ela já possuir titular;
      -- Apenas inicializa caso esteja NULL no banco
      manager_id = COALESCE(public.cm_redes_matrizes.manager_id, EXCLUDED.manager_id),
      manager = COALESCE(public.cm_redes_matrizes.manager, EXCLUDED.manager);
  END IF;
  RETURN NEW;
END;
$$;

-- 2. NOVA TRIGGER FUNCTION HIERÁRQUICA SEGURO cm_redes_matrizes -> cm_clientes
-- Propaga a alteração do titular da rede para as lojas em cm_clientes, PRESERVANDO
-- estritamente exceções de cm_base_atendimento_regional e cm_regras_apuracao_comercial
CREATE OR REPLACE FUNCTION public.sync_cm_redes_matrizes_to_clientes_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só processa se houve alteração real do gerente da rede
  IF (TG_OP = 'UPDATE' AND (NEW.manager_id IS DISTINCT FROM OLD.manager_id OR NEW.manager IS DISTINCT FROM OLD.manager))
     OR (TG_OP = 'INSERT' AND NEW.manager_id IS NOT NULL) THEN
     
    -- Atualiza todas as lojas vinculadas à rede que NÃO possuem regra regional explícita
    UPDATE public.cm_clientes c
    SET 
      responsavel = NEW.manager,
      manager_name = NEW.manager,
      manager_id = NEW.manager_id
    WHERE c.codigo_matriz = NEW.codigo
      -- Proteção contra loops e updates redundantes: só atualiza se for diferente
      AND (c.manager_id IS DISTINCT FROM NEW.manager_id OR c.responsavel IS DISTINCT FROM NEW.manager)
      -- Proteção 1: NÃO atualiza lojas com exceção regional ativa em cm_base_atendimento_regional
      AND NOT EXISTS (
        SELECT 1 
        FROM public.cm_base_atendimento_regional bar
        WHERE bar.cliente_matriz_id = NEW.codigo
          AND bar.estado = c.uf
          AND bar.ativo = true
      )
      -- Proteção 2: NÃO atualiza lojas com regra especial homologada em cm_regras_apuracao_comercial
      AND NOT EXISTS (
        SELECT 1 
        FROM public.cm_regras_apuracao_comercial rac
        WHERE rac.matriz_nome = NEW.nome
          AND (rac.uf IS NULL OR rac.uf = c.uf)
          AND rac.ativa = true
      );
      
  END IF;
  RETURN NEW;
END;
$$;

-- 3. INSTALAÇÃO DA TRIGGER EM cm_redes_matrizes
DROP TRIGGER IF EXISTS tg_sync_cm_redes_matrizes_to_clientes ON public.cm_redes_matrizes;
CREATE TRIGGER tg_sync_cm_redes_matrizes_to_clientes
AFTER INSERT OR UPDATE OF manager_id, manager ON public.cm_redes_matrizes
FOR EACH ROW
EXECUTE FUNCTION public.sync_cm_redes_matrizes_to_clientes_safe();

COMMIT;

-- =============================================================================
-- BLOCO DOWN (ROLLBACK)
-- =============================================================================
/*
BEGIN;
DROP TRIGGER IF EXISTS tg_sync_cm_redes_matrizes_to_clientes ON public.cm_redes_matrizes;
DROP FUNCTION IF EXISTS public.sync_cm_redes_matrizes_to_clientes_safe();

CREATE OR REPLACE FUNCTION public.sync_cm_clientes_to_redes_matrizes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_matriz IS NOT NULL AND NEW.matriz IS NOT NULL THEN
    INSERT INTO public.cm_redes_matrizes (codigo, nome, canal, min_cod_parceiro, manager_id, manager)
    VALUES (
      NEW.codigo_matriz,
      NEW.matriz,
      COALESCE(NULLIF(NEW.tipo_parceiro, ''), 'Outros'),
      NEW.codigo::text,
      NEW.manager_id,
      NEW.manager_name
    )
    ON CONFLICT (codigo) DO UPDATE
    SET
      nome = EXCLUDED.nome,
      canal = COALESCE(NULLIF(EXCLUDED.canal, ''), public.cm_redes_matrizes.canal),
      manager_id = EXCLUDED.manager_id,
      manager = EXCLUDED.manager;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
*/
