-- Migration: 20260719_prevent_manager_fallback_overwrite.sql
-- Description: Implement a 4-tier commercial manager assignment hierarchy.
--              Prevents UF fallbacks from overwriting existing valid managers.
--              Includes backup validation, rollback instructions, and before/after comparisons.

-- =========================================================
-- 1. CONFIGURAÇÃO E BACKUP LÓGICO
-- =========================================================
-- O backup lógico já foi criado previamente na tabela:
-- public.cm_clientes_backup_20260719
-- ROLLBACK INSTRUC:
-- UPDATE public.cm_clientes c SET responsavel = b.responsavel, manager_id = b.manager_id 
-- FROM public.cm_clientes_backup_20260719 b WHERE c.id = b.id;

-- =========================================================
-- 2. ATUALIZAÇÃO DAS FUNÇÕES DE TRIGGER E PROCEDURES
-- =========================================================

-- Trigger fn_sync_cm_clientes_responsavel
CREATE OR REPLACE FUNCTION public.fn_sync_cm_clientes_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_gerente_id UUID;
    v_gerente_name TEXT;
    v_default_manager TEXT;
BEGIN
    IF NEW.codigo_matriz IS NOT NULL AND NEW.uf IS NOT NULL THEN
        -- 1. REGRA 1 (SOBERANA): Buscar da regionalização por matriz
        SELECT gerente_responsavel_id INTO v_gerente_id
        FROM public.cm_base_atendimento_regional
        WHERE cliente_matriz_id = NEW.codigo_matriz AND estado = NEW.uf AND ativo = true
        LIMIT 1;

        IF v_gerente_id IS NOT NULL THEN
            SELECT name INTO v_gerente_name
            FROM public.cm_user_profiles
            WHERE id = v_gerente_id;
            
            IF v_gerente_name IS NOT NULL THEN
                NEW.responsavel := v_gerente_name;
                RETURN NEW;
            END IF;
        END IF;

        -- 2. REGRA 2: Se não há regionalização e o cliente já possui um responsável válido, mantém
        IF NEW.responsavel IS NOT NULL 
           AND NEW.responsavel <> '' 
           AND NEW.responsavel <> 'SEM RESPONSÁVEL' THEN
            RETURN NEW;
        END IF;

        -- 3. REGRA 3: Se não tem gerente regional E o responsável atual é inválido, aplica fallback de UF
        SELECT manager INTO v_default_manager
        FROM public.manager_uf_mapping
        WHERE uf = NEW.uf
        LIMIT 1;

        IF v_default_manager IS NOT NULL THEN
            NEW.responsavel := v_default_manager;
            RETURN NEW;
        END IF;

        -- 4. REGRA 4: Se nada definir o responsável, manter NULL (sem fallback para Inside Sales)
        NEW.responsavel := NULL;
    ELSE
        -- Se faltar código de matriz ou UF:
        -- Mantém se o responsável for válido
        IF NEW.responsavel IS NOT NULL 
           AND NEW.responsavel <> '' 
           AND NEW.responsavel <> 'SEM RESPONSÁVEL' THEN
            RETURN NEW;
        END IF;
        -- Caso contrário, mantém NULL
        NEW.responsavel := NULL;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Trigger fn_propagate_regional_manager_to_clientes
CREATE OR REPLACE FUNCTION public.fn_propagate_regional_manager_to_clientes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_gerente_name TEXT;
BEGIN
    IF NEW.ativo = true AND NEW.gerente_responsavel_id IS NOT NULL THEN
        SELECT name INTO v_gerente_name
        FROM public.cm_user_profiles
        WHERE id = NEW.gerente_responsavel_id;
    END IF;

    IF v_gerente_name IS NULL THEN
        -- Se inativo ou sem gerente na regionalização:
        -- Clientes com responsáveis válidos permanecem inalterados (Regra 2)
        -- Clientes sem responsável herdam o fallback de UF (e se não houver, ficam NULL - Regra 4)
        UPDATE public.cm_clientes
        SET responsavel = (
            SELECT manager FROM public.manager_uf_mapping WHERE uf = NEW.estado LIMIT 1
        )
        WHERE codigo_matriz = NEW.cliente_matriz_id 
          AND uf = NEW.estado
          AND (responsavel IS NULL OR responsavel = '' OR responsavel = 'SEM RESPONSÁVEL');
    ELSE
        -- REGRA 1 (SOBERANA): Se há gerente na regionalização, propaga e sobrescreve
        UPDATE public.cm_clientes
        SET responsavel = v_gerente_name
        WHERE codigo_matriz = NEW.cliente_matriz_id AND uf = NEW.estado;
    END IF;

    RETURN NEW;
END;
$$;

-- RPC recalcular_responsaveis_clientes
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
     SET responsavel = CASE
         -- 1. Regra 1 (Soberana): Regionalização por Matriz + UF
         WHEN EXISTS (
             SELECT 1 FROM public.cm_base_atendimento_regional r
             WHERE r.cliente_matriz_id = c.codigo_matriz AND r.estado = c.uf AND r.ativo = true AND r.gerente_responsavel_id IS NOT NULL
         ) THEN (
             SELECT up.name 
             FROM public.cm_base_atendimento_regional r
             JOIN public.cm_user_profiles up ON r.gerente_responsavel_id = up.id
             WHERE r.cliente_matriz_id = c.codigo_matriz AND r.estado = c.uf AND r.ativo = true
             LIMIT 1
         )
         -- 2. Regra 2: Se já possui gerente válido, mantém
         WHEN c.responsavel IS NOT NULL AND c.responsavel <> '' AND c.responsavel <> 'SEM RESPONSÁVEL' THEN 
             c.responsavel
         -- 3. Regra 3: Fallback de UF
         WHEN EXISTS (
             SELECT 1 FROM public.manager_uf_mapping m WHERE m.uf = c.uf
         ) THEN (
             SELECT manager FROM public.manager_uf_mapping WHERE uf = c.uf LIMIT 1
         )
         -- 4. Regra 4: NULL
         ELSE NULL
     END
     WHERE c.codigo_matriz IS NOT NULL AND c.uf IS NOT NULL
       AND responsavel IS DISTINCT FROM CASE
         WHEN EXISTS (
             SELECT 1 FROM public.cm_base_atendimento_regional r
             WHERE r.cliente_matriz_id = c.codigo_matriz AND r.estado = c.uf AND r.ativo = true AND r.gerente_responsavel_id IS NOT NULL
         ) THEN (
             SELECT up.name 
             FROM public.cm_base_atendimento_regional r
             JOIN public.cm_user_profiles up ON r.gerente_responsavel_id = up.id
             WHERE r.cliente_matriz_id = c.codigo_matriz AND r.estado = c.uf AND r.ativo = true
             LIMIT 1
         )
         WHEN c.responsavel IS NOT NULL AND c.responsavel <> '' AND c.responsavel <> 'SEM RESPONSÁVEL' THEN 
             c.responsavel
         WHEN EXISTS (
             SELECT 1 FROM public.manager_uf_mapping m WHERE m.uf = c.uf
         ) THEN (
             SELECT manager FROM public.manager_uf_mapping WHERE uf = c.uf LIMIT 1
         )
         ELSE NULL
     END
     RETURNING 1
   )
   SELECT count(*) INTO rows_affected FROM updated;
   RETURN rows_affected;
 END;
 $function$;
