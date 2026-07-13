-- Add display_order column to cm_user_favorites
ALTER TABLE public.cm_user_favorites ADD COLUMN IF NOT EXISTS display_order INTEGER NULL;

-- Create composite index for user_id and display_order for performance optimization
CREATE INDEX IF NOT EXISTS idx_cm_user_favorites_user_id_display_order 
ON public.cm_user_favorites (user_id, display_order);
