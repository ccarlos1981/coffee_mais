-- Migration: Create cm_weekly_projections_workflow table
-- Date: 2026-08-04
-- Author: Coffee++ Engineering Team

CREATE TABLE IF NOT EXISTS public.cm_weekly_projections_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  month integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  submitted_by text,
  submitted_at timestamptz,
  approved_by text,
  approved_at timestamptz,
  approved_comments text,
  frozen_by text,
  frozen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT cm_weekly_projections_workflow_year_month_key UNIQUE (year, month)
);

COMMENT ON TABLE public.cm_weekly_projections_workflow IS 'Workflow de aprovação e congelamento do planejamento comercial por rede';
