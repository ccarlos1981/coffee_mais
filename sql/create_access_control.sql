-- 1. Create a table to store user profiles, specifically their roles
CREATE TABLE IF NOT EXISTS cm_user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'Vendedor',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for cm_user_profiles
ALTER TABLE cm_user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can view own profile" 
ON cm_user_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Allow admins to read all profiles (assuming anyone authenticated can read basic profiles for now, or refine if needed)
CREATE POLICY "All authenticated users can view profiles" 
ON cm_user_profiles FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role to do everything
CREATE POLICY "Service role has full access to user profiles" 
ON cm_user_profiles FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);

-- 2. Create a table to store role permissions per module
CREATE TABLE IF NOT EXISTS cm_role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role text NOT NULL,
  module_name text NOT NULL,
  has_access boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(role, module_name)
);

-- Turn on RLS for cm_role_permissions
ALTER TABLE cm_role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read permissions so UI can adapt
CREATE POLICY "All authenticated users can view role permissions" 
ON cm_role_permissions FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role to do everything
CREATE POLICY "Service role has full access to role permissions" 
ON cm_role_permissions FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);

-- 3. Initial Data Population for cm_role_permissions
-- The roles are: CEO, Diretor, Gerente Nacional, Gerente Regional, Trade, Supervisor, Vendedor, Promotor
-- The modules from the dashboard: 
-- Resumo (Sales Overview), Vendedores (Sellers Management), Investimento (Investments), 
-- Base de Atendimento (Service Base), Metas (Goals), Materiais (Materials), 
-- Treinamentos (Trainings), Fale Conosco (Contact Us), Usuários (User Management)

-- Just an example initial script (we can manage this via the UI later)
-- Insert basic modules for CEO and Admin (Full Access)
INSERT INTO cm_role_permissions (role, module_name, has_access)
VALUES
  ('Admin', 'Resumo', true),
  ('Admin', 'Vendedores', true),
  ('Admin', 'Investimento', true),
  ('Admin', 'Base de Atendimento', true),
  ('Admin', 'Metas', true),
  ('Admin', 'Materiais', true),
  ('Admin', 'Treinamentos', true),
  ('Admin', 'Fale Conosco', true),
  ('Admin', 'Usuários', true),
  ('CEO', 'Resumo', true),
  ('CEO', 'Vendedores', true),
  ('CEO', 'Investimento', true),
  ('CEO', 'Base de Atendimento', true),
  ('CEO', 'Metas', true),
  ('CEO', 'Materiais', true),
  ('CEO', 'Treinamentos', true),
  ('CEO', 'Fale Conosco', true),
  ('CEO', 'Usuários', true)
ON CONFLICT (role, module_name) DO NOTHING;

-- 4. Fill cm_user_profiles for existing users
-- Since we don't know everyone's role, we can set them to 'Vendedor' initially
INSERT INTO cm_user_profiles (id, role)
SELECT id, 'Vendedor' FROM auth.users
ON CONFLICT (id) DO NOTHING;
