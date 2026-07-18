-- Migration: 20260718_fix_pdv_transfer_trigger_loop.sql
-- Description: Corrige o loop de triggers na transferência de PDV removendo a trigger regional do UPDATE de cm_clientes e adicionando salvaguarda de pg_trigger_depth() nas triggers de sincronização.

-- 1. Modificar a trigger regional para rodar exclusivamente em INSERT
DROP TRIGGER IF EXISTS trg_sync_cm_clientes_responsavel ON public.cm_clientes;

CREATE TRIGGER trg_sync_cm_clientes_responsavel
BEFORE INSERT ON public.cm_clientes
FOR EACH ROW
EXECUTE FUNCTION fn_sync_cm_clientes_responsavel();

-- 2. Recriar a função de sincronização cm_clientes -> base_atendimento com proteção contra recursão
CREATE OR REPLACE FUNCTION public.sync_cm_clientes_to_base_atendimento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  -- Salvaguarda arquitetural para evitar qualquer reentrância ou loops circulares
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.codigo IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO base_atendimento (cod_parceiro, cnpj, nome_parceiro, rede, manager, uf, canal, status, manager_id)
  VALUES (
    NEW.codigo::text,
    NEW.cnpj,
    NEW.nome_parceiro,
    NEW.matriz,
    NEW.manager_name,
    NEW.uf,
    NEW.tipo_parceiro,
    COALESCE(NEW.status, 'ativo'),
    NEW.manager_id
  )
  ON CONFLICT (cod_parceiro) DO UPDATE
  SET
    cnpj = EXCLUDED.cnpj,
    nome_parceiro = EXCLUDED.nome_parceiro,
    rede = EXCLUDED.rede,
    manager = EXCLUDED.manager,
    uf = EXCLUDED.uf,
    canal = EXCLUDED.canal,
    status = EXCLUDED.status,
    manager_id = EXCLUDED.manager_id;
  RETURN NEW;
END;
$function$;

-- 3. Recriar a função de sincronização base_atendimento -> cm_clientes com proteção contra recursão
CREATE OR REPLACE FUNCTION public.sync_base_atendimento_to_cm_clientes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Salvaguarda arquitetural para evitar qualquer reentrância ou loops circulares
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.cod_parceiro IS NULL OR NEW.cod_parceiro !~ '^[0-9]+$' THEN
    RETURN NEW;
  END IF;

  INSERT INTO cm_clientes (codigo, cnpj, nome_parceiro, razao_social, matriz, tipo_parceiro, responsavel, uf, regional, ka, status)
  VALUES (
    NEW.cod_parceiro::integer,
    NEW.cnpj,
    NEW.nome_parceiro,
    NEW.nome_parceiro,
    NEW.rede,
    NEW.canal,
    NEW.manager,
    NEW.uf,
    NEW.regional,
    NEW.ka,
    COALESCE(NEW.status, 'ativo')
  )
  ON CONFLICT (codigo) DO UPDATE
  SET
    cnpj = CASE WHEN cm_clientes.cnpj IS DISTINCT FROM EXCLUDED.cnpj THEN EXCLUDED.cnpj ELSE cm_clientes.cnpj END,
    nome_parceiro = CASE WHEN cm_clientes.nome_parceiro IS DISTINCT FROM EXCLUDED.nome_parceiro THEN EXCLUDED.nome_parceiro ELSE cm_clientes.nome_parceiro END,
    razao_social = CASE WHEN cm_clientes.razao_social IS DISTINCT FROM EXCLUDED.razao_social THEN EXCLUDED.razao_social ELSE cm_clientes.razao_social END,
    matriz = CASE WHEN cm_clientes.matriz IS DISTINCT FROM EXCLUDED.matriz THEN EXCLUDED.matriz ELSE cm_clientes.matriz END,
    tipo_parceiro = CASE WHEN cm_clientes.tipo_parceiro IS DISTINCT FROM EXCLUDED.tipo_parceiro THEN EXCLUDED.tipo_parceiro ELSE cm_clientes.tipo_parceiro END,
    responsavel = CASE WHEN cm_clientes.responsavel IS DISTINCT FROM EXCLUDED.responsavel THEN EXCLUDED.responsavel ELSE cm_clientes.responsavel END,
    uf = CASE WHEN cm_clientes.uf IS DISTINCT FROM EXCLUDED.uf THEN EXCLUDED.uf ELSE cm_clientes.uf END,
    regional = CASE WHEN cm_clientes.regional IS DISTINCT FROM EXCLUDED.regional THEN EXCLUDED.regional ELSE cm_clientes.regional END,
    ka = CASE WHEN cm_clientes.ka IS DISTINCT FROM EXCLUDED.ka THEN EXCLUDED.ka ELSE cm_clientes.ka END,
    status = CASE WHEN cm_clientes.status IS DISTINCT FROM EXCLUDED.status THEN EXCLUDED.status ELSE cm_clientes.status END
  WHERE
    cm_clientes.cnpj IS DISTINCT FROM EXCLUDED.cnpj OR
    cm_clientes.nome_parceiro IS DISTINCT FROM EXCLUDED.nome_parceiro OR
    cm_clientes.razao_social IS DISTINCT FROM EXCLUDED.razao_social OR
    cm_clientes.matriz IS DISTINCT FROM EXCLUDED.matriz OR
    cm_clientes.tipo_parceiro IS DISTINCT FROM EXCLUDED.tipo_parceiro OR
    cm_clientes.responsavel IS DISTINCT FROM EXCLUDED.responsavel OR
    cm_clientes.uf IS DISTINCT FROM EXCLUDED.uf OR
    cm_clientes.regional IS DISTINCT FROM EXCLUDED.regional OR
    cm_clientes.ka IS DISTINCT FROM EXCLUDED.ka OR
    cm_clientes.status IS DISTINCT FROM EXCLUDED.status;
    
  RETURN NEW;
END;
$function$;
