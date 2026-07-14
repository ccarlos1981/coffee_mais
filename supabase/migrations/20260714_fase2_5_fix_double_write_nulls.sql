-- Migration: 20260714_fase2_5_fix_double_write_nulls.sql
-- Description: Fase 2.5 - Correção de consistência de NULLs na dupla escrita de gerentes

-- 1. Redefinir a função fn_get_manager_employee_code para retornar NULL em caso de entrada nula ou vazia
CREATE OR REPLACE FUNCTION public.fn_get_manager_employee_code(p_name text)
RETURNS text AS $$
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN NULL;
  END IF;

  RETURN CASE 
    WHEN p_name IN ('Julliano') THEN '1000'
    WHEN p_name IN ('Leandro', 'Leandro Saffi') THEN '1001'
    WHEN p_name IN ('Luiz') THEN '1002'
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Redefinir a função de trigger tg_fn_double_write_manager para propagar NULLs corretamente e evitar mapear '9999' para 'Outros'
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
      IF NEW.responsavel IS NOT NULL AND NEW.manager_id IS NULL THEN
        NEW.manager_id := public.fn_get_manager_employee_code(NEW.responsavel);
      ELSIF NEW.manager_id IS NOT NULL AND NEW.responsavel IS NULL THEN
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

-- 3. Limpar inconsistências de registros onde o nome do gestor é nulo
UPDATE public.base_atendimento SET manager_id = NULL WHERE manager IS NULL AND manager_id = '9999';
UPDATE public.cm_clientes SET manager_id = NULL WHERE responsavel IS NULL AND manager_id = '9999';
UPDATE public.sales_legacy SET manager_id = NULL WHERE manager IS NULL AND manager_id = '9999';
UPDATE public.cm_trade_calendario_anual SET manager_id = NULL WHERE gerente IS NULL AND manager_id = '9999';
