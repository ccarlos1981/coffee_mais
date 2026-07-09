-- ============================================================
-- Migration: Add client/network identifier to pesquisa_light
-- Date: 07/09/2026
-- ============================================================

ALTER TABLE public.cm_promotor_pesquisa_light 
ADD COLUMN IF NOT EXISTS codigo_matriz TEXT;
