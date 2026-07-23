-- ====================================================================
-- MÓDULO CARTA DE ANUÊNCIA (GESTÃO DE CARTAS DE QUITAÇÃO COFFEE++)
-- Data: 23/07/2026
-- ====================================================================

-- 1. Tabela de Competências Parametrizadas
CREATE TABLE IF NOT EXISTS public.cm_competencias_anuencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competencia VARCHAR(50) UNIQUE NOT NULL, -- Ex: "Junho/2026"
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    encerrada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed de Competências Iniciais
INSERT INTO public.cm_competencias_anuencia (competencia, data_inicio, data_fim)
VALUES 
    ('Dezembro/2025', '2025-01-01', '2025-12-31'),
    ('Junho/2026', '2025-07-01', '2026-06-30'),
    ('Dezembro/2026', '2026-01-01', '2026-12-31')
ON CONFLICT (competencia) DO NOTHING;

-- 2. Tabela de Master Data de Logos das Redes
CREATE TABLE IF NOT EXISTS public.cm_logos_redes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rede_id TEXT NOT NULL,
    logo_url TEXT NOT NULL,
    origem TEXT DEFAULT 'MANUAL',
    validada BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_logos_redes_rede_id ON public.cm_logos_redes(rede_id);

-- 3. Sequência e Função para Numeração Oficial Única (CA-YYYY-XXXXXX)
CREATE SEQUENCE IF NOT EXISTS public.seq_carta_anuencia_numero START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.fn_generate_numero_carta_anuencia()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_year TEXT := TO_CHAR(NOW(), 'YYYY');
    v_seq INT;
    v_numero TEXT;
BEGIN
    SELECT nextval('public.seq_carta_anuencia_numero') INTO v_seq;
    v_numero := 'CA-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
    RETURN v_numero;
END;
$$;

-- 4. Tabela Principal de Cartas de Anuência
CREATE TABLE IF NOT EXISTS public.cm_cartas_anuencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_carta VARCHAR(50) UNIQUE NOT NULL,
    versao INT DEFAULT 1,
    carta_origem_id UUID REFERENCES public.cm_cartas_anuencia(id) ON DELETE SET NULL,
    rede_id TEXT NOT NULL,
    rede_nome TEXT NOT NULL,
    cnpj VARCHAR(30) NULL,
    competencia_id UUID REFERENCES public.cm_competencias_anuencia(id) ON DELETE SET NULL,
    competencia VARCHAR(50) NOT NULL,
    data_emissao TIMESTAMPTZ DEFAULT NOW(),
    data_assinatura TIMESTAMPTZ NULL,
    valida_ate DATE NULL, -- Data limite de validade da quitação
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EMITIDA', 'ENVIADA', 'ASSINADA', 'CANCELADA')),
    logo_id UUID REFERENCES public.cm_logos_redes(id) ON DELETE SET NULL,
    logo_rede_url TEXT NULL,
    logo_coffee_url TEXT NULL,
    pdf_url TEXT NULL,
    arquivo_assinado_url TEXT NULL,
    usuario_emissao UUID NULL,
    usuario_emissao_nome TEXT NULL,
    usuario_assinatura UUID NULL,
    usuario_assinatura_nome TEXT NULL,
    observacoes TEXT NULL,
    assinatura_metodo VARCHAR(50) NULL, -- 'MANUAL', 'DOCUSIGN', 'CLICKSIGN', 'EGOV'
    assinatura_hash TEXT NULL,
    assinatura_protocolo TEXT NULL,
    qr_code_hash TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unicidade Lógica: Impedir múltiplas cartas ativas para o mesmo par (rede_id, competencia)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unicidade_carta_ativa 
ON public.cm_cartas_anuencia (rede_id, competencia) 
WHERE status != 'CANCELADA';

CREATE INDEX IF NOT EXISTS idx_cm_cartas_anuencia_rede ON public.cm_cartas_anuencia(rede_id);
CREATE INDEX IF NOT EXISTS idx_cm_cartas_anuencia_status ON public.cm_cartas_anuencia(status);
CREATE INDEX IF NOT EXISTS idx_cm_cartas_anuencia_numero ON public.cm_cartas_anuencia(numero_carta);

-- 5. Tabela da Timeline de Eventos da Carta
CREATE TABLE IF NOT EXISTS public.cm_carta_anuencia_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carta_id UUID NOT NULL REFERENCES public.cm_cartas_anuencia(id) ON DELETE CASCADE,
    evento VARCHAR(50) NOT NULL, -- 'CRIADA', 'PDF_GERADO', 'COMPARTILHADA', 'DOWNLOAD', 'REENVIADA', 'UPLOAD_ASSINADA', 'CANCELADA'
    canal VARCHAR(30) NULL, -- 'EMAIL', 'WHATSAPP', 'LINK', 'DOWNLOAD'
    detalhes JSONB NULL,
    usuario_id UUID NULL,
    usuario_nome TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cm_carta_anuencia_timeline_carta ON public.cm_carta_anuencia_timeline(carta_id);

-- 6. Habilitar RLS
ALTER TABLE public.cm_competencias_anuencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_logos_redes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_cartas_anuencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_carta_anuencia_timeline ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (RLS) para Usuários Autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cm_competencias_anuencia_policy') THEN
        CREATE POLICY cm_competencias_anuencia_policy ON public.cm_competencias_anuencia FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cm_logos_redes_policy') THEN
        CREATE POLICY cm_logos_redes_policy ON public.cm_logos_redes FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cm_cartas_anuencia_policy') THEN
        CREATE POLICY cm_cartas_anuencia_policy ON public.cm_cartas_anuencia FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cm_carta_anuencia_timeline_policy') THEN
        CREATE POLICY cm_carta_anuencia_timeline_policy ON public.cm_carta_anuencia_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. Provisionamento de Supabase Storage (cartas-anuencia)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'cartas-anuencia', 
    'cartas-anuencia', 
    true, 
    20971520, -- 20MB
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cartas_anuencia_storage_public_select') THEN
        CREATE POLICY cartas_anuencia_storage_public_select ON storage.objects FOR SELECT USING (bucket_id = 'cartas-anuencia');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cartas_anuencia_storage_auth_insert') THEN
        CREATE POLICY cartas_anuencia_storage_auth_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cartas-anuencia');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cartas_anuencia_storage_auth_update') THEN
        CREATE POLICY cartas_anuencia_storage_auth_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cartas-anuencia');
    END IF;
END $$;
