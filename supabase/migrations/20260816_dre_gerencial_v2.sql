-- ============================================================
-- DRE Gerencial V2 — Migration
-- Tabelas para importação da planilha DRE e armazenamento
-- dos dados financeiros por rede/competência.
--
-- NÃO altera nenhuma tabela existente.
-- ============================================================

-- 1. Batches de importação
CREATE TABLE IF NOT EXISTS public.cm_dre_gerencial_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    competencia TEXT NOT NULL,       -- '2026-07'
    ano INT NOT NULL,
    mes INT NOT NULL,
    imported_by UUID REFERENCES auth.users(id),
    imported_at TIMESTAMPTZ DEFAULT now(),
    total_rows INT DEFAULT 0,
    total_redes INT DEFAULT 0,
    redes_matched INT DEFAULT 0,
    redes_unmatched INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validated','imported','error')),
    validation_result JSONB,
    error_log TEXT
);

CREATE INDEX IF NOT EXISTS idx_dre_ger_batches_comp ON public.cm_dre_gerencial_batches (competencia);

-- 2. Staging (dados brutos da planilha, pré-validação)
CREATE TABLE IF NOT EXISTS public.cm_dre_gerencial_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.cm_dre_gerencial_batches(id) ON DELETE CASCADE,
    row_number INT,
    rede_planilha TEXT NOT NULL,           -- Nome original da planilha
    rede_normalizada TEXT,                 -- UPPER(TRIM(...)) sem prefixo UF
    responsavel_planilha TEXT,             -- Responsável da planilha (informativo)
    gerente_sistema TEXT,                  -- Gerente resolvido pelo sistema
    competencia TEXT NOT NULL,
    icms_pct NUMERIC DEFAULT 0,
    cpv_valor NUMERIC DEFAULT 0,          -- Já em R$ (×1000 aplicado)
    investimento_valor NUMERIC DEFAULT 0, -- Abatimento, já em R$
    contrato_valor NUMERIC DEFAULT 0,     -- Já em R$
    fat_bruto_informativo NUMERIC DEFAULT 0, -- Fat da planilha (informativo, NÃO usado no DRE)
    match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('matched','unmatched','pending')),
    match_rede_sistema TEXT,              -- Nome da rede no sistema após match
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dre_ger_staging_batch ON public.cm_dre_gerencial_staging (batch_id);

-- 3. Tabela principal — dados financeiros por rede/competência
CREATE TABLE IF NOT EXISTS public.cm_dre_gerencial_rede (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competencia TEXT NOT NULL,             -- '2026-07'
    ano INT NOT NULL,
    mes INT NOT NULL,
    rede TEXT NOT NULL,                    -- Nome da rede no sistema (ex: 'BISTEK')
    rede_planilha TEXT,                    -- Nome original da planilha (auditoria)
    gerente_atual TEXT,                    -- Gerente no momento da importação
    canal TEXT DEFAULT 'KA',

    -- Dados da planilha (já em R$ reais, ×1000 aplicado)
    icms_pct NUMERIC NOT NULL DEFAULT 0,
    cpv_valor NUMERIC NOT NULL DEFAULT 0,
    investimento_valor NUMERIC NOT NULL DEFAULT 0,   -- = Abatimento
    contrato_valor NUMERIC NOT NULL DEFAULT 0,
    bonificacao_valor NUMERIC NOT NULL DEFAULT 0,     -- = 0 até definição oficial

    -- Auditoria
    batch_id UUID REFERENCES public.cm_dre_gerencial_batches(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Unicidade: uma entrada por rede×competência (UPSERT)
    UNIQUE(competencia, rede)
);

CREATE INDEX IF NOT EXISTS idx_dre_ger_rede_comp ON public.cm_dre_gerencial_rede (competencia);
CREATE INDEX IF NOT EXISTS idx_dre_ger_rede_ano_mes ON public.cm_dre_gerencial_rede (ano, mes);
CREATE INDEX IF NOT EXISTS idx_dre_ger_rede_gerente ON public.cm_dre_gerencial_rede (gerente_atual);

-- 4. Trigger de updated_at
CREATE OR REPLACE FUNCTION public.fn_dre_gerencial_rede_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_dre_gerencial_rede_updated ON public.cm_dre_gerencial_rede;
CREATE TRIGGER tg_dre_gerencial_rede_updated
    BEFORE UPDATE ON public.cm_dre_gerencial_rede
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_dre_gerencial_rede_updated_at();

-- 5. RLS
ALTER TABLE public.cm_dre_gerencial_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_gerencial_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_dre_gerencial_rede ENABLE ROW LEVEL SECURITY;

-- Leitura para todos autenticados
CREATE POLICY "dre_ger_batches_read" ON public.cm_dre_gerencial_batches
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "dre_ger_staging_read" ON public.cm_dre_gerencial_staging
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "dre_ger_rede_read" ON public.cm_dre_gerencial_rede
    FOR SELECT TO authenticated USING (true);

-- Escrita via service_role (Server Actions)
CREATE POLICY "dre_ger_batches_write" ON public.cm_dre_gerencial_batches
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "dre_ger_staging_write" ON public.cm_dre_gerencial_staging
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "dre_ger_rede_write" ON public.cm_dre_gerencial_rede
    FOR ALL TO service_role USING (true) WITH CHECK (true);
