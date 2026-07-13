-- Create cm_user_favorites table
CREATE TABLE IF NOT EXISTS public.cm_user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT cm_user_favorites_user_id_module_key_key UNIQUE (user_id, module_key)
);

-- Enable RLS
ALTER TABLE public.cm_user_favorites ENABLE ROW LEVEL SECURITY;

-- Select policy: users can select their own favorites
CREATE POLICY cm_user_favorites_select ON public.cm_user_favorites
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Insert policy: users can insert their own favorites
CREATE POLICY cm_user_favorites_insert ON public.cm_user_favorites
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Delete policy: users can delete their own favorites
CREATE POLICY cm_user_favorites_delete ON public.cm_user_favorites
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Index for performance (on user_id)
CREATE INDEX IF NOT EXISTS idx_cm_user_favorites_user_id ON public.cm_user_favorites(user_id);
