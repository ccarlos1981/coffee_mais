-- Migration: Criar tabela cm_rdm_slide_status para governança visual de status de slides no RDM
-- Escopo Inicial: slide_key = 'dre'
-- Autorização: Exclusiva para cristiano.santos@coffeemais.com

CREATE TABLE IF NOT EXISTS public.cm_rdm_slide_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  slide_key TEXT NOT NULL,
  is_outdated BOOLEAN NOT NULL DEFAULT false,
  marked_by TEXT NULL,
  marked_at TIMESTAMPTZ NULL,
  unmarked_by TEXT NULL,
  unmarked_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_cm_rdm_slide_status UNIQUE (manager, year, month, slide_key),
  CONSTRAINT chk_cm_rdm_slide_key_allowed CHECK (slide_key IN ('dre'))
);

-- Índices de performance para busca rápida
CREATE INDEX IF NOT EXISTS idx_cm_rdm_slide_status_lookup 
  ON public.cm_rdm_slide_status (manager, year, month, slide_key);

-- Habilitar RLS
ALTER TABLE public.cm_rdm_slide_status ENABLE ROW LEVEL SECURITY;

-- Remover policies anteriores caso existam
DROP POLICY IF EXISTS "cm_rdm_slide_status_select_auth" ON public.cm_rdm_slide_status;
DROP POLICY IF EXISTS "cm_rdm_slide_status_insert_auth" ON public.cm_rdm_slide_status;
DROP POLICY IF EXISTS "cm_rdm_slide_status_update_auth" ON public.cm_rdm_slide_status;
DROP POLICY IF EXISTS "cm_rdm_slide_status_delete_auth" ON public.cm_rdm_slide_status;
DROP POLICY IF EXISTS "cm_rdm_slide_status_write_auth" ON public.cm_rdm_slide_status;

-- 1. SELECT para todos os autenticados
CREATE POLICY "cm_rdm_slide_status_select_auth"
  ON public.cm_rdm_slide_status FOR SELECT
  TO authenticated
  USING (true);

-- 2. INSERT exclusivo para Cristiano
CREATE POLICY "cm_rdm_slide_status_insert_auth"
  ON public.cm_rdm_slide_status FOR INSERT
  TO authenticated
  WITH CHECK (LOWER(auth.jwt() ->> 'email') = 'cristiano.santos@coffeemais.com');

-- 3. UPDATE exclusivo para Cristiano
CREATE POLICY "cm_rdm_slide_status_update_auth"
  ON public.cm_rdm_slide_status FOR UPDATE
  TO authenticated
  USING (LOWER(auth.jwt() ->> 'email') = 'cristiano.santos@coffeemais.com')
  WITH CHECK (LOWER(auth.jwt() ->> 'email') = 'cristiano.santos@coffeemais.com');

-- 4. NÃO EXISTE POLICY DE DELETE (Operação DELETE proibida na governança)
