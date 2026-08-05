-- Migration: Add codigo_matriz column to cm_weekly_projections
-- Date: 2026-08-04
-- Author: Coffee++ Engineering Team

ALTER TABLE public.cm_weekly_projections
  ADD COLUMN IF NOT EXISTS codigo_matriz text;

COMMENT ON COLUMN public.cm_weekly_projections.codigo_matriz IS 'Código soberano da matriz/rede para integração com cadastro mestre e RPS';
