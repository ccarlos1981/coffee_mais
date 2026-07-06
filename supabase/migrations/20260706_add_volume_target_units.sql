-- ============================================================
-- Migration: Add volume_target_units to cm_promotor_metas
-- Date: 07/06/2026
-- ============================================================

ALTER TABLE public.cm_promotor_metas 
ADD COLUMN IF NOT EXISTS volume_target_units NUMERIC(15, 2) DEFAULT NULL;
