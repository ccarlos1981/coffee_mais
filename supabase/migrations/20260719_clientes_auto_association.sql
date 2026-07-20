-- Create cm_responsavel_regras table
CREATE TABLE IF NOT EXISTS public.cm_responsavel_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prioridade INT NOT NULL DEFAULT 0,
  tipo_regra TEXT NOT NULL,
  campo_origem TEXT NOT NULL,
  operador TEXT NOT NULL,
  valor_origem TEXT NOT NULL,
  responsavel_resultado TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cm_responsavel_sugestoes table
CREATE TABLE IF NOT EXISTS public.cm_responsavel_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.cm_clientes(id) ON DELETE CASCADE,
  responsavel_sugerido TEXT NOT NULL,
  origem_sugestao TEXT NOT NULL,
  confianca NUMERIC NOT NULL,
  motivo TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'aprovado', 'rejeitado')) DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT
);

-- Enable RLS
ALTER TABLE public.cm_responsavel_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cm_responsavel_sugestoes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, and recreate
DROP POLICY IF EXISTS cm_responsavel_regras_policy ON public.cm_responsavel_regras;
CREATE POLICY cm_responsavel_regras_policy ON public.cm_responsavel_regras
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cm_responsavel_sugestoes_policy ON public.cm_responsavel_sugestoes;
CREATE POLICY cm_responsavel_sugestoes_policy ON public.cm_responsavel_sugestoes;
CREATE POLICY cm_responsavel_sugestoes_policy ON public.cm_responsavel_sugestoes
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cm_responsavel_regras_ativo_prioridade ON public.cm_responsavel_regras(ativo, prioridade);
CREATE INDEX IF NOT EXISTS idx_cm_responsavel_sugestoes_cliente_id ON public.cm_responsavel_sugestoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cm_responsavel_sugestoes_status ON public.cm_responsavel_sugestoes(status);

-- Seed initial rules for special channels
INSERT INTO public.cm_responsavel_regras (prioridade, tipo_regra, campo_origem, operador, valor_origem, responsavel_resultado, observacao) VALUES
  (10, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'SHOPIFY', 'Inside Sales', 'Shopify maps to Inside Sales'),
  (20, 'VENDEDOR', 'nome_vendedor', 'PREFIX', 'AMAZON', 'Amazon', 'Any Amazon sales to Amazon'),
  (30, 'VENDEDOR', 'nome_vendedor', 'PREFIX', 'MELI', 'Marketplace', 'Meli/Mercado Livre to Marketplace'),
  (40, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'SHOPEE', 'Marketplace', 'Shopee to Marketplace'),
  (50, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'ANYMARKET', 'Marketplace', 'Anymarket integrations to Marketplace'),
  (60, 'VENDEDOR', 'nome_vendedor', 'PREFIX', 'MAGALU', 'Marketplace', 'Magalu sales to Marketplace'),
  (70, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'EXPORTAÇÃO', 'Exportação', 'Export sales to Exportação channel'),
  (80, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'DISTRIBUIDOR', 'Distribuidor', 'Distribuidor sales to Distribuidor channel'),
  (90, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'KEYACCOUNT', 'Key Account', 'General key accounts fallback'),
  (100, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'LUISA', 'Luisa', 'Luisa individual seller mapping'),
  (110, 'VENDEDOR', 'nome_vendedor', 'EQUALS', 'FERNANDA', 'Inside Sales', 'Fernanda under Inside Sales')
ON CONFLICT DO NOTHING;

-- Create transactional save function (RPC)
CREATE OR REPLACE FUNCTION public.fn_save_suggestions_transactional(suggestions_to_insert jsonb)
RETURNS void AS $$
BEGIN
  -- Delete all previous pending suggestions
  DELETE FROM public.cm_responsavel_sugestoes WHERE status = 'pendente';
  
  -- Insert new suggestions
  INSERT INTO public.cm_responsavel_sugestoes (
    cliente_id, 
    responsavel_sugerido, 
    origem_sugestao, 
    confianca, 
    motivo, 
    status
  )
  SELECT 
    (value->>'cliente_id')::uuid,
    value->>'responsavel_sugerido',
    value->>'origem_sugestao',
    (value->>'confianca')::numeric,
    value->>'motivo',
    'pendente'
  FROM jsonb_array_elements(suggestions_to_insert);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
