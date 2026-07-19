-- Migration: 20260719_centralize_ownership_logic.sql
-- Description: Centralize commercial manager ownership logic into a single function.
--              Treats legacy fallbacks ('SEM RESPONSÁVEL', 'Inside Sales') as invalid.
--              Provides recalcular_responsaveis_clientes_por_codigos for batch/lote execution.
--              Refactors existing triggers and global RPC to reuse the central logic.

-- =========================================================
-- 1. CRIAÇÃO DA FUNÇÃO CENTRAL DE CÁLCULO (SINGLE SOURCE OF TRUTH)
-- =========================================================
CREATE OR REPLACE FUNCTION public.calcular_responsavel_cliente(
    p_codigo_matriz text,
    p_uf text,
    p_responsavel_atual text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_gerente_id UUID;
    v_gerente_name TEXT;
    v_default_manager TEXT;
BEGIN
    IF p_codigo_matriz IS NOT NULL AND p_uf IS NOT NULL THEN
        -- 1. REGRA 1 (SOBERANA): Buscar da regionalização por matriz
        -- Unicidade garantida pela constraint cm_base_atendimento_regional_unique
        SELECT r.gerente_responsavel_id INTO v_gerente_id
        FROM public.cm_base_atendimento_regional r
        WHERE r.cliente_matriz_id = p_codigo_matriz 
          AND r.estado = p_uf 
          AND r.ativo = true;

        IF v_gerente_id IS NOT NULL THEN
            SELECT name INTO v_gerente_name
            FROM public.cm_user_profiles
            WHERE id = v_gerente_id;
            
            IF v_gerente_name IS NOT NULL THEN
                RETURN v_gerente_name;
            END IF;
        END IF;

        -- 2. REGRA 2: Se não há regionalização e o cliente já possui um responsável válido, mantém
        -- Tratamos 'SEM RESPONSÁVEL' e 'Inside Sales' como valores legados/inválidos para forçar o recálculo
        IF p_responsavel_atual IS NOT NULL 
           AND p_responsavel_atual <> '' 
           AND p_responsavel_atual <> 'SEM RESPONSÁVEL' 
           AND p_responsavel_atual <> 'Inside Sales' THEN
            RETURN p_responsavel_atual;
        END IF;

        -- 3. REGRA 3: Se não tem gerente regional E o responsável atual é inválido, aplica Fallback Territorial por UF
        SELECT manager INTO v_default_manager
        FROM public.manager_uf_mapping
        WHERE uf = p_uf;

        IF v_default_manager IS NOT NULL THEN
            RETURN v_default_manager;
        END IF;

        -- 4. REGRA 4: Se nada definir o responsável, mantém NULL
        RETURN NULL;
    ELSE
        -- Se faltar código de matriz ou UF:
        -- Mantém se o responsável atual for válido e não-legado
        IF p_responsavel_atual IS NOT NULL 
           AND p_responsavel_atual <> '' 
           AND p_responsavel_atual <> 'SEM RESPONSÁVEL'
           AND p_responsavel_atual <> 'Inside Sales' THEN
            RETURN p_responsavel_atual;
        END IF;
        -- Caso contrário, mantém NULL
        RETURN NULL;
    END IF;
END;
$function$;

-- =========================================================
-- 2. CRIAÇÃO DA RPC PARAMETRIZADA POR CODIGOS
-- =========================================================
CREATE OR REPLACE FUNCTION public.recalcular_responsaveis_clientes_por_codigos(p_codigos integer[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rows_affected integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.cm_clientes c
    SET responsavel = public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel)
    WHERE c.codigo = ANY(p_codigos)
      AND c.responsavel IS DISTINCT FROM public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel)
    RETURNING 1
  )
  SELECT count(*) INTO rows_affected FROM updated;
  RETURN rows_affected;
END;
$function$;

-- =========================================================
-- 3. REFATORAÇÃO DOS GATILHOS E RPCS EXISTENTES
-- =========================================================

-- Trigger Function: fn_sync_cm_clientes_responsavel
CREATE OR REPLACE FUNCTION public.fn_sync_cm_clientes_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    NEW.responsavel := public.calcular_responsavel_cliente(NEW.codigo_matriz, NEW.uf, NEW.responsavel);
    RETURN NEW;
END;
$function$;

-- Trigger Function: fn_propagate_regional_manager_to_clientes
CREATE OR REPLACE FUNCTION public.fn_propagate_regional_manager_to_clientes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cm_clientes
    SET responsavel = public.calcular_responsavel_cliente(codigo_matriz, uf, responsavel)
    WHERE codigo_matriz = NEW.cliente_matriz_id AND uf = NEW.estado;

    RETURN NEW;
END;
$$;

-- RPC Function: recalcular_responsaveis_clientes (Global)
CREATE OR REPLACE FUNCTION public.recalcular_responsaveis_clientes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  rows_affected integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.cm_clientes c
    SET responsavel = public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel)
    WHERE c.responsavel IS DISTINCT FROM public.calcular_responsavel_cliente(c.codigo_matriz, c.uf, c.responsavel)
    RETURNING 1
  )
  SELECT count(*) INTO rows_affected FROM updated;
  RETURN rows_affected;
END;
$function$;
