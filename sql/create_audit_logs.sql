-- Criação da tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS cm_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Opcional, mas boa prática)
ALTER TABLE cm_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy genérica para Admins lerem os logs
DROP POLICY IF EXISTS "Admins podem visualizar audit logs" ON cm_audit_logs;
CREATE POLICY "Admins podem visualizar audit logs"
    ON cm_audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM cm_user_profiles WHERE role = 'Admin'
        )
    );

-- Permitir inserts do Service Role e triggers (SECURITY DEFINER)
DROP POLICY IF EXISTS "Service Role pode inserir audit logs" ON cm_audit_logs;
CREATE POLICY "Service Role pode inserir audit logs"
    ON cm_audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Função genérica que servirá de Trigger
CREATE OR REPLACE FUNCTION cm_audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Tenta pegar o ID do usuário da sessão atual do Supabase
    current_user_id := auth.uid();
    
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO cm_audit_logs (table_name, action, old_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD)::jsonb, current_user_id);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO cm_audit_logs (table_name, action, old_data, new_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO cm_audit_logs (table_name, action, new_data, user_id)
        VALUES (TG_TABLE_NAME, TG_OP, row_to_json(NEW)::jsonb, current_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar a Trigger nas principais tabelas
-- 1. Investimentos
DROP TRIGGER IF EXISTS audit_cm_acoes_investimento ON cm_acoes_investimento;
CREATE TRIGGER audit_cm_acoes_investimento
    AFTER INSERT OR UPDATE OR DELETE ON cm_acoes_investimento
    FOR EACH ROW EXECUTE FUNCTION cm_audit_trigger_func();

-- 2. Perfis de Usuário
DROP TRIGGER IF EXISTS audit_cm_user_profiles ON cm_user_profiles;
CREATE TRIGGER audit_cm_user_profiles
    AFTER INSERT OR UPDATE OR DELETE ON cm_user_profiles
    FOR EACH ROW EXECUTE FUNCTION cm_audit_trigger_func();

-- 3. Permissões
DROP TRIGGER IF EXISTS audit_cm_role_permissions ON cm_role_permissions;
CREATE TRIGGER audit_cm_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON cm_role_permissions
    FOR EACH ROW EXECUTE FUNCTION cm_audit_trigger_func();

-- 4. PDVs
DROP TRIGGER IF EXISTS audit_pdvs ON pdvs;
CREATE TRIGGER audit_pdvs
    AFTER INSERT OR UPDATE OR DELETE ON pdvs
    FOR EACH ROW EXECUTE FUNCTION cm_audit_trigger_func();
