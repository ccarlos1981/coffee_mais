-- Migration: 20260908_create_cm_carta_anuencia_farol_redes_config.sql
-- Description: Tabela de parametrização administrativa para inclusão/exclusão determinística de redes no Farol Executivo Gerencial
-- Author: Coffee++ Engineering Team

CREATE TABLE IF NOT EXISTS public.cm_carta_anuencia_farol_redes_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_matriz TEXT NOT NULL,
  rede_nome TEXT NOT NULL,
  gerente TEXT NOT NULL,
  tipo_acao TEXT NOT NULL CHECK (tipo_acao IN ('INCLUSAO', 'EXCLUSAO')),
  motivo TEXT,
  is_ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID,
  criado_por_nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único parcial para garantir que exista apenas UM estado ativo por operação
CREATE UNIQUE INDEX IF NOT EXISTS idx_farol_redes_config_active 
  ON public.cm_carta_anuencia_farol_redes_config (codigo_matriz, gerente, rede_nome) 
  WHERE is_ativo = true;

CREATE INDEX IF NOT EXISTS idx_farol_redes_config_ativo 
  ON public.cm_carta_anuencia_farol_redes_config (is_ativo);

-- Habilitar RLS
ALTER TABLE public.cm_carta_anuencia_farol_redes_config ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Permitir leitura para autenticados" 
  ON public.cm_carta_anuencia_farol_redes_config 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir modificação para service_role" 
  ON public.cm_carta_anuencia_farol_redes_config 
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT ON public.cm_carta_anuencia_farol_redes_config TO anon, authenticated;
GRANT ALL ON public.cm_carta_anuencia_farol_redes_config TO service_role;
