-- Migration: 20260715_customer_ownership_single_source.sql
-- Description: Unificar o ownership comercial no cadastro único de clientes e sincronizar com base_atendimento e cm_redes_matrizes.

-- 1. Adicionar colunas caso não existam
ALTER TABLE public.cm_clientes 
ADD COLUMN IF NOT EXISTS manager_name TEXT;

ALTER TABLE public.cm_redes_matrizes 
ADD COLUMN IF NOT EXISTS manager_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS manager TEXT;

-- 2. Redefinir a função de trigger tg_fn_double_write_manager
CREATE OR REPLACE FUNCTION public.tg_fn_double_write_manager()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'cm_clientes' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.manager_name IS DISTINCT FROM OLD.manager_name THEN
        NEW.responsavel := NEW.manager_name;
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager_name);
      ELSIF NEW.responsavel IS DISTINCT FROM OLD.responsavel THEN
        NEW.manager_name := NEW.responsavel;
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
        NEW.manager_name := NEW.responsavel;
      END IF;
    ELSE
      -- INSERT
      IF NEW.manager_name IS NOT NULL THEN
        NEW.responsavel := NEW.manager_name;
        IF NEW.manager_id IS NULL THEN
          NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager_name);
        END IF;
      ELSIF NEW.responsavel IS NOT NULL THEN
        NEW.manager_name := NEW.responsavel;
        IF NEW.manager_id IS NULL THEN
          NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
        END IF;
      ELSIF NEW.manager_id IS NOT NULL THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
        NEW.manager_name := NEW.responsavel;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'cm_trade_calendario_anual' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.gerente IS DISTINCT FROM OLD.gerente THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.gerente);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.gerente := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
      END IF;
    ELSE
      -- INSERT
      IF NEW.gerente IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.gerente);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.gerente IS NULL THEN
        NEW.gerente := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
      END IF;
    END IF;
  ELSE
    -- targets, cm_weekly_projections, network_matrix, base_atendimento, sales_legacy
    IF TG_OP = 'UPDATE' THEN
      IF NEW.manager IS DISTINCT FROM OLD.manager THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
      END IF;
    ELSE
      -- INSERT
      IF NEW.manager IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.manager IS NULL THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1004' THEN 'Inside Sales'
          WHEN '1005' THEN 'Ecommerce'
          WHEN '1006' THEN 'Marketplace'
          WHEN '1007' THEN 'Distribuidor'
          WHEN '1008' THEN 'Amazon 1P'
          WHEN '1009' THEN 'Private Label'
          WHEN '1010' THEN 'Luisa'
          ELSE NULL
        END;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Redefinir a função de trigger sync_cm_clientes_to_redes_matrizes
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

-- 4. Redefinir a função de trigger sync_cm_clientes_to_base_atendimento
CREATE OR REPLACE FUNCTION public.sync_cm_clientes_to_base_atendimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- 5. Backfill dos dados existentes
UPDATE public.cm_clientes 
SET manager_name = responsavel 
WHERE manager_name IS NULL AND responsavel IS NOT NULL;

UPDATE public.cm_redes_matrizes rm
SET 
  manager_id = c.manager_id,
  manager = c.responsavel
FROM (
  SELECT DISTINCT ON (codigo_matriz) codigo_matriz, manager_id, responsavel
  FROM public.cm_clientes
  WHERE codigo_matriz IS NOT NULL AND (manager_id IS NOT NULL OR responsavel IS NOT NULL)
  ORDER BY codigo_matriz, created_at DESC
) c
WHERE rm.codigo = c.codigo_matriz AND rm.manager_id IS NULL;
