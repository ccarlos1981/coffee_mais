-- ============================================================
-- Migration: Create Promoter Light Survey Table
-- Date: 07/08/2026
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cm_promotor_pesquisa_light (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    promotor_id UUID REFERENCES public.cm_employees(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    rede VARCHAR(255) NOT NULL,
    preco_flat NUMERIC(10, 2) NOT NULL,
    tipo_flat VARCHAR(50) NOT NULL CHECK (tipo_flat IN ('Moído', 'Grão')),
    preco_gourmet NUMERIC(10, 2) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.cm_promotor_pesquisa_light ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: All authenticated users can read surveys
CREATE POLICY "Permitir leitura para autenticados"
ON public.cm_promotor_pesquisa_light
FOR SELECT
TO authenticated
USING (true);

-- INSERT Policy: All authenticated users can insert new surveys
CREATE POLICY "Permitir inserção para autenticados"
ON public.cm_promotor_pesquisa_light
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Indexes for querying performance
CREATE INDEX IF NOT EXISTS idx_cm_promotor_pesquisa_light_promotor 
ON public.cm_promotor_pesquisa_light(promotor_id);

CREATE INDEX IF NOT EXISTS idx_cm_promotor_pesquisa_light_created_at 
ON public.cm_promotor_pesquisa_light(created_at DESC);
