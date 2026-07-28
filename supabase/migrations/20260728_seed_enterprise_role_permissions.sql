-- ==============================================================================
-- MIGRATION DML: Hardening de Permissões Padrão — Plataforma Comercial & Health
-- Data: 28/07/2026
-- Objetivo: Popular a tabela cm_role_permissions com permissões padrão para os
--           novos módulos da Plataforma Comercial Enterprise e Health Center,
--           garantindo controle de acesso dinâmico sem necessidade de fallbacks.
-- ==============================================================================

DO $$
BEGIN
    -- Inserir permissões para Plataforma Comercial Enterprise e Health Center
    -- apenas para combinações (role, module_name) que ainda não existam no banco.

    -- 1. Módulos da Plataforma Comercial Enterprise
    -- Conceder acesso padrão para roles comerciais e administrativas:
    -- (Admin, CEO, Diretor, Gerente Nacional, Gerente Regional, Trade, Supervisor, Vendedor, TI)
    INSERT INTO public.cm_role_permissions (role, module_name, has_access)
    SELECT r.role, m.module_name, m.has_access
    FROM (
        SELECT 'Admin' AS role UNION ALL
        SELECT 'CEO' UNION ALL
        SELECT 'Diretor' UNION ALL
        SELECT 'Gerente Nacional' UNION ALL
        SELECT 'Gerente Regional' UNION ALL
        SELECT 'Trade' UNION ALL
        SELECT 'Supervisor' UNION ALL
        SELECT 'Vendedor' UNION ALL
        SELECT 'Promotor' UNION ALL
        SELECT 'Financeiro' UNION ALL
        SELECT 'RH' UNION ALL
        SELECT 'TI'
    ) r
    CROSS JOIN (
        SELECT 'CRM Enterprise' AS module_name, true AS default_commercial, false AS default_health UNION ALL
        SELECT 'Execução Comercial', true, false UNION ALL
        SELECT 'Assistente de Decisão', true, false UNION ALL
        SELECT 'Simulação Estratégica', true, false UNION ALL
        SELECT 'S&OP Comercial', true, false UNION ALL
        SELECT 'Health Center', false, true
    ) m
    CROSS JOIN LATERAL (
        SELECT CASE
            WHEN m.module_name = 'Health Center' THEN
                r.role IN ('Admin', 'CEO', 'Diretor', 'TI')
            ELSE
                r.role IN ('Admin', 'CEO', 'Diretor', 'Gerente Nacional', 'Gerente Regional', 'Trade', 'Supervisor', 'Vendedor', 'TI')
        END AS has_access
    ) acc
    WHERE NOT EXISTS (
        SELECT 1 
        FROM public.cm_role_permissions existing 
        WHERE existing.role = r.role 
          AND existing.module_name = m.module_name
    );

    RAISE NOTICE 'Migration 20260728_seed_enterprise_role_permissions concluída com sucesso.';
END $$;
