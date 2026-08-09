-- =================================================================
-- Migration: Domínio Comercial Unificado — Commercial Master Data
-- Data: 2026-08-09
--
-- Cria as tabelas oficiais do domínio comercial configurável:
-- cm_domain_channels, cm_domain_segments, cm_domain_status,
-- cm_domain_business_units, cm_domain_regions, cm_domain_roles,
-- cm_domain_normalization_rules, cm_domain_version
--
-- NÃO cria tabelas para Redes (usa cm_redes_matrizes — DA1)
-- NÃO cria tabelas para UFs (usa manager_uf_mapping — DA2)
--
-- @see RFC — Domínio Comercial Unificado (Baseline Permanente)
-- =================================================================

BEGIN;

-- =================================================================
-- 1. CANAIS COMERCIAIS
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_channels (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  db_value    TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_channels (id, label, db_value, sort_order) VALUES
  ('KA',            'KA (Key Account)',  'KA',            1),
  ('DISTRIBUIDOR',  'Distribuidor',      'Distribuidor',  2),
  ('INSIDE_SALES',  'Inside Sales',      'Inside Sales',  3),
  ('INSIDE_INTER',  'Inside Inter',      'Inside inter',  4),
  ('EXPORTACAO',    'Exportação',        'Exportação',    5),
  ('MARCA_PROPRIA', 'Marca Própria',     'Marca Própria', 6),
  ('ECOMMERCE',     'E-commerce',        'Ecommerce',     7),
  ('MARKETPLACE',   'Marketplace',       'Marketplace',   8),
  ('AMAZON_1P',     'Amazon 1P',         'Amazon 1P',     9),
  ('OUTROS',        'Outros',            'Outros',        99)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 2. SEGMENTOS COMERCIAIS
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_segments (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_segments (id, label, sort_order) VALUES
  ('SUPERMERCADO',     'Supermercado',     1),
  ('ATACAREJO',        'Atacarejo',        2),
  ('CONVENIENCIA',     'Conveniência',     3),
  ('FARMACIA',         'Farmácia',         4),
  ('PADARIA',          'Padaria',          5),
  ('CASH_CARRY',       'Cash & Carry',     6),
  ('FOOD_SERVICE',     'Food Service',     7),
  ('VAREJO_ALIMENTAR', 'Varejo Alimentar', 8),
  ('OUTROS',           'Outros',           99)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 3. STATUS COMERCIAIS
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_status (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'client',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_status (id, label, category, sort_order) VALUES
  ('ATIVO',       'Ativo',       'client', 1),
  ('INATIVO',     'Inativo',     'client', 2),
  ('SUSPENSO',    'Suspenso',    'client', 3),
  ('PROSPECCAO',  'Prospecção',  'client', 4)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 4. UNIDADES DE NEGÓCIO
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_business_units (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_business_units (id, label, sort_order) VALUES
  ('COFFEE_MAIS', 'Coffee Mais', 1)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 5. REGIONAIS COMERCIAIS
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_regions (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  manager_id  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_regions (id, label, manager_id, sort_order) VALUES
  ('SUL',       'Sul',                     '1001', 1),
  ('SUDESTE',   'Sudeste',                 '1000', 2),
  ('SU_CO_NE',  'Sudeste/Centro-Oeste/NE', '1002', 3),
  ('CO_NO',     'Centro-Oeste/Norte',      '1003', 4),
  ('INSIDE',    'Inside Sales',            '1004', 5)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 6. ROLES COMERCIAIS
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_roles (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_roles (id, label, sort_order) VALUES
  ('KA',            'Key Account',     1),
  ('DIST',          'Distribuidor',    2),
  ('EXPORT',        'Exportação',      3),
  ('FOOD',          'Food Service',    4),
  ('ATACADO',       'Atacado',         5),
  ('PRIVATE_LABEL', 'Private Label',   6),
  ('ECOMMERCE',     'E-commerce',      7),
  ('MARKETPLACE',   'Marketplace',     8)
ON CONFLICT (id) DO NOTHING;

-- =================================================================
-- 7. REGRAS DE NORMALIZAÇÃO
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_normalization_rules (
  id                  SERIAL PRIMARY KEY,
  domain              TEXT NOT NULL,
  legacy_value        TEXT NOT NULL,
  official_id         TEXT NOT NULL,
  inferred_segment_id TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain, legacy_value)
);

INSERT INTO public.cm_domain_normalization_rules (domain, legacy_value, official_id, inferred_segment_id) VALUES
  ('channel', 'DISTRIBUICAO',  'DISTRIBUIDOR',  NULL),
  ('channel', 'DISTRIBUIDOR',  'DISTRIBUIDOR',  NULL),
  ('channel', 'Key Account',   'KA',            NULL),
  ('channel', 'KEY ACCOUNT',   'KA',            NULL),
  ('channel', 'E-COMMERCE',    'ECOMMERCE',     NULL),
  ('channel', 'Private Label', 'MARCA_PROPRIA', NULL),
  ('channel', 'MARCA PROPRIA', 'MARCA_PROPRIA', NULL),
  ('channel', 'Marca Propria', 'MARCA_PROPRIA', NULL),
  ('channel', 'SUPERMERCADO',  'KA',            'SUPERMERCADO'),
  ('channel', 'ATACAREJO',     'KA',            'ATACAREJO'),
  ('channel', 'ATACADO',       'KA',            'ATACAREJO'),
  ('channel', 'CONVENIENCIA',  'KA',            'CONVENIENCIA'),
  ('channel', 'FARMACIA',      'KA',            'FARMACIA'),
  ('channel', 'CASH & CARRY',  'KA',            'CASH_CARRY'),
  ('channel', 'B2B',           'INSIDE_SALES',  NULL),
  ('channel', 'VAREJO C ON',   'KA',            'VAREJO_ALIMENTAR'),
  ('channel', 'VAREJO F OUT',  'KA',            'VAREJO_ALIMENTAR')
ON CONFLICT (domain, legacy_value) DO NOTHING;

-- =================================================================
-- 8. VERSIONAMENTO DO DOMÍNIO
-- =================================================================
CREATE TABLE IF NOT EXISTS public.cm_domain_version (
  id          SERIAL PRIMARY KEY,
  version     TEXT NOT NULL,
  description TEXT NOT NULL,
  user_id     UUID,
  user_email  TEXT,
  checksum    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.cm_domain_version (version, description, checksum)
VALUES (
  '1.0.0',
  'Criação inicial do Domínio Comercial Unificado — 10 canais, 9 segmentos, 4 status, 5 regionais, 8 roles, 17 regras de normalização',
  md5(
    (SELECT string_agg(id || ':' || db_value, ',' ORDER BY sort_order) FROM public.cm_domain_channels) || '|' ||
    (SELECT string_agg(id || ':' || label, ',' ORDER BY sort_order) FROM public.cm_domain_segments)
  )
);

-- =================================================================
-- 9. PREPARAÇÃO: Adicionar coluna segmento em cm_clientes
-- =================================================================
ALTER TABLE public.cm_clientes ADD COLUMN IF NOT EXISTS segmento TEXT;

-- =================================================================
-- 10. RLS — Tabelas de domínio são read-only para todos os roles
-- =================================================================
ALTER TABLE public.cm_domain_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_normalization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_domain_version ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública (authenticated)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'cm_domain_channels', 'cm_domain_segments', 'cm_domain_status',
    'cm_domain_business_units', 'cm_domain_regions', 'cm_domain_roles',
    'cm_domain_normalization_rules', 'cm_domain_version'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY IF NOT EXISTS "domain_%s_read" ON public.%I FOR SELECT TO authenticated USING (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- =================================================================
-- 11. GRANT para service_role (Admin)
-- =================================================================
GRANT ALL ON public.cm_domain_channels TO service_role;
GRANT ALL ON public.cm_domain_segments TO service_role;
GRANT ALL ON public.cm_domain_status TO service_role;
GRANT ALL ON public.cm_domain_business_units TO service_role;
GRANT ALL ON public.cm_domain_regions TO service_role;
GRANT ALL ON public.cm_domain_roles TO service_role;
GRANT ALL ON public.cm_domain_normalization_rules TO service_role;
GRANT ALL ON public.cm_domain_version TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cm_domain_normalization_rules_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE cm_domain_version_id_seq TO service_role;

COMMIT;
