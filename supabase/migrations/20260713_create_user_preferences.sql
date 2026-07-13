-- Criar a tabela cm_user_preferences
CREATE TABLE IF NOT EXISTS public.cm_user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    investimento_sort_column TEXT NULL,
    investimento_sort_direction TEXT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.cm_user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para cm_user_preferences
CREATE POLICY cm_user_preferences_select ON public.cm_user_preferences
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY cm_user_preferences_insert ON public.cm_user_preferences
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY cm_user_preferences_update ON public.cm_user_preferences
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY cm_user_preferences_delete ON public.cm_user_preferences
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Index para otimização de busca pelo ID do usuário
CREATE INDEX IF NOT EXISTS idx_cm_user_preferences_user_id ON public.cm_user_preferences(user_id);
