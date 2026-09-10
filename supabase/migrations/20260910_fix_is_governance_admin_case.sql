-- Migration: 20260910_fix_is_governance_admin_case.sql
-- Description: Correção case-insensitive da autorização de administradores de Governança / Master Data
-- RFC: Governança / Autorização Master Data (Aprovada pelo Product Owner)
-- Regras Preservadas: SECURITY DEFINER, SET search_path = public, pg_temp.
-- Não altera dados físicos de cm_user_profiles.

CREATE OR REPLACE FUNCTION public.is_governance_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.cm_user_profiles
        WHERE id = p_user_id 
          AND role IS NOT NULL
          AND TRIM(LOWER(role)) = 'admin'
    );
END;
$$;
