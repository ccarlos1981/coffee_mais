-- 1. Criar a tabela de funcionários (cm_employees)
CREATE TABLE IF NOT EXISTS cm_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    identidade TEXT,
    data_nascimento DATE,
    funcao TEXT,
    area_funcao TEXT,
    data_admissao DATE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE cm_employees ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de RLS
-- Permissão total para service_role (gerenciamento por triggers/admin)
DROP POLICY IF EXISTS "Service role has full access to employees" ON cm_employees;
CREATE POLICY "Service role has full access to employees"
ON cm_employees FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- Permissão de leitura (SELECT) para usuários autenticados autorizados
DROP POLICY IF EXISTS "Users with Gente e Gestao permission can view employees" ON cm_employees;
CREATE POLICY "Users with Gente e Gestao permission can view employees"
ON cm_employees FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cm_user_profiles up
    JOIN cm_role_permissions rp ON up.role = rp.role
    WHERE up.id = auth.uid()
      AND rp.module_name = 'Gente e Gestão'
      AND rp.has_access = true
  ) OR EXISTS (
    SELECT 1 FROM cm_user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'CEO'
  )
);

-- Permissão total (INSERT/UPDATE/DELETE) para usuários autenticados autorizados
DROP POLICY IF EXISTS "Users with Gente e Gestao permission can manage employees" ON cm_employees;
CREATE POLICY "Users with Gente e Gestao permission can manage employees"
ON cm_employees FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM cm_user_profiles up
    JOIN cm_role_permissions rp ON up.role = rp.role
    WHERE up.id = auth.uid()
      AND rp.module_name = 'Gente e Gestão'
      AND rp.has_access = true
  ) OR EXISTS (
    SELECT 1 FROM cm_user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'CEO'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM cm_user_profiles up
    JOIN cm_role_permissions rp ON up.role = rp.role
    WHERE up.id = auth.uid()
      AND rp.module_name = 'Gente e Gestão'
      AND rp.has_access = true
  ) OR EXISTS (
    SELECT 1 FROM cm_user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'CEO'
  )
);

-- 4. Criar Trigger de Auditoria para registrar inserções/atualizações/deleções
DROP TRIGGER IF EXISTS audit_cm_employees ON cm_employees;
CREATE TRIGGER audit_cm_employees
    AFTER INSERT OR UPDATE OR DELETE ON cm_employees
    FOR EACH ROW EXECUTE FUNCTION cm_audit_trigger_func();

-- 5. Inserir permissões padrões na matriz de acessos para Admin, CEO e RH
INSERT INTO cm_role_permissions (role, module_name, has_access)
VALUES
  ('Admin', 'Gente e Gestão', true),
  ('CEO', 'Gente e Gestão', true),
  ('RH', 'Gente e Gestão', true)
ON CONFLICT (role, module_name) DO UPDATE
SET has_access = EXCLUDED.has_access;
