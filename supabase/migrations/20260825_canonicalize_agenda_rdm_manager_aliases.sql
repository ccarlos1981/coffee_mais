-- Migration: 20260825_canonicalize_agenda_rdm_manager_aliases.sql
-- Objetivo: Canonicalização dos aliases de gerentes nas tabelas cm_agenda_rotas e cm_rdm_comments (P4.2)
-- Contexto: Unificação de 'Leandro' para 'Leandro Saffi' garantindo 0 perda de dados e integridade referencial.

DO $$
BEGIN
  -- 1. Sanitizar cm_agenda_rotas
  UPDATE public.cm_agenda_rotas
  SET manager = 'Leandro Saffi',
      updated_at = NOW()
  WHERE manager = 'Leandro';

  -- 2. Sanitizar cm_rdm_comments
  UPDATE public.cm_rdm_comments
  SET manager = 'Leandro Saffi',
      updated_at = NOW()
  WHERE manager = 'Leandro';

END $$;
