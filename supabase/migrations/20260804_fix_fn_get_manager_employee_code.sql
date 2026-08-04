-- =============================================================================
-- Migration: 20260804_fix_fn_get_manager_employee_code.sql
-- Descrição: Correção da Causa Raiz da Atribuição de manager_id = '9999'
--            Atualiza a função fn_get_manager_employee_code e a trigger
--            tg_fn_double_write_manager para registrar '1003' para John Guedes
--            e consultar dinamicamente cm_user_profiles.
-- =============================================================================

BEGIN;

-- 1. Atualizar função de obtenção de employee_code com busca dinâmica em cm_user_profiles
CREATE OR REPLACE FUNCTION public.fn_get_manager_employee_code(p_name text)
RETURNS text AS $$
DECLARE
  v_code text;
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN NULL;
  END IF;

  -- Busca prioritária dinâmica por employee_code em cm_user_profiles
  SELECT employee_code INTO v_code
  FROM public.cm_user_profiles
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_name))
     OR LOWER(TRIM(manager_name)) = LOWER(TRIM(p_name))
  LIMIT 1;

  IF v_code IS NOT NULL AND v_code <> '' THEN
    RETURN v_code;
  END IF;

  -- Fallback para tabela de regras explícitas
  RETURN CASE 
    WHEN p_name IN ('Julliano') THEN '1000'
    WHEN p_name IN ('Leandro', 'Leandro Saffi') THEN '1001'
    WHEN p_name IN ('Luiz') THEN '1002'
    WHEN p_name IN ('John Guedes', 'John') THEN '1003'
    WHEN p_name IN ('Inside Sales') THEN '1004'
    WHEN p_name IN ('Ecommerce') THEN '1005'
    WHEN p_name IN ('Marketplace') THEN '1006'
    WHEN p_name IN ('Distribuidor') THEN '1007'
    WHEN p_name IN ('Amazon 1P', '1p') THEN '1008'
    WHEN p_name IN ('Private Label', 'Marca Própria') THEN '1009'
    WHEN p_name IN ('Luisa') THEN '1010'
    ELSE '9999'
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Atualizar a trigger de dupla escrita para cm_clientes e base_atendimento
CREATE OR REPLACE FUNCTION public.tg_fn_double_write_manager()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'cm_clientes' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.responsavel IS DISTINCT FROM OLD.responsavel THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1003' THEN 'John Guedes'
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
      IF NEW.responsavel IS NOT NULL AND (NEW.manager_id IS NULL OR NEW.manager_id = '9999') THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.responsavel IS NULL THEN
        NEW.responsavel := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1003' THEN 'John Guedes'
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
  ELSIF TG_TABLE_NAME = 'base_atendimento' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.manager IS DISTINCT FROM OLD.manager THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS DISTINCT FROM OLD.manager_id THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1003' THEN 'John Guedes'
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
      IF NEW.manager IS NOT NULL AND (NEW.manager_id IS NULL OR NEW.manager_id = '9999') THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.manager);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.manager IS NULL THEN
        NEW.manager := CASE NEW.manager_id
          WHEN '1000' THEN 'Julliano'
          WHEN '1001' THEN 'Leandro Saffi'
          WHEN '1002' THEN 'Luiz'
          WHEN '1003' THEN 'John Guedes'
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

-- 3. Atualizar registros em cm_clientes para sincronizar manager_id = '1003'
UPDATE public.cm_clientes
SET manager_id = '1003'
WHERE (responsavel = 'John Guedes' OR uf IN ('DF', 'GO', 'MS', 'MT', 'TO', 'AM', 'PA'))
  AND (manager_id IS NULL OR manager_id = '9999');

COMMIT;
