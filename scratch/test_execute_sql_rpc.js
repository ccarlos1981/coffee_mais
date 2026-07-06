require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS public.cm_skus_conversao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    codigo_integracao VARCHAR(100),
    peso_embalagem_kg NUMERIC(10, 4) NOT NULL CHECK (peso_embalagem_kg > 0),
    unidades_por_caixa INTEGER NOT NULL DEFAULT 1 CHECK (unidades_por_caixa > 0),
    vigencia_inicio DATE,
    vigencia_fim DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    observacao TEXT,
    motivo_alteracao TEXT,
    unidade_medida VARCHAR(20) DEFAULT 'UN',
    caixas_por_pallet INTEGER,
    weight_pallet_kg NUMERIC(10, 4),
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cm_skus_conversao_product ON public.cm_skus_conversao(product_id);
CREATE INDEX IF NOT EXISTS idx_cm_skus_conversao_codigo ON public.cm_skus_conversao(codigo_integracao);

CREATE OR REPLACE FUNCTION public.check_cm_skus_conversao_overlap()
RETURNS TRIGGER AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    IF NEW.ativo = false THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO overlap_count
    FROM public.cm_skus_conversao
    WHERE product_id = NEW.product_id
      AND ativo = true
      AND id <> NEW.id
      AND (
          (COALESCE(vigencia_inicio, '-infinity'::date), COALESCE(vigencia_fim, 'infinity'::date)) OVERLAPS
          (COALESCE(NEW.vigencia_inicio, '-infinity'::date), COALESCE(NEW.vigencia_fim, 'infinity'::date))
      );

    IF overlap_count > 0 THEN
        RAISE EXCEPTION 'Erro de Integridade: Existe sobreposição de vigência ativa para o produto ID %', NEW.product_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cm_skus_conversao_overlap
BEFORE INSERT OR UPDATE ON public.cm_skus_conversao
FOR EACH ROW EXECUTE FUNCTION public.check_cm_skus_conversao_overlap();

CREATE OR REPLACE VIEW public.v_produtos_detalhes AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.line AS product_line,
    p.type AS product_type,
    p.weight AS product_weight_desc,
    p.active AS product_active,
    c.id AS conversao_id,
    c.codigo_integracao,
    COALESCE(c.peso_embalagem_kg, 0) AS peso_embalagem_kg,
    COALESCE(c.unidades_por_caixa, 1) AS unidades_por_caixa,
    COALESCE(c.peso_embalagem_kg * c.unidades_por_caixa, 0) AS peso_total_caixa_kg,
    c.unidade_medida,
    c.caixas_por_pallet,
    c.weight_pallet_kg AS peso_pallet_kg,
    c.vigencia_inicio,
    c.vigencia_fim,
    c.observacao,
    c.motivo_alteracao,
    COALESCE(c.ativo, false) AS conversao_ativa
FROM public.products p
LEFT JOIN public.cm_skus_conversao c ON p.id = c.product_id;

INSERT INTO public.cm_skus_conversao (product_id, codigo_integracao, peso_embalagem_kg, unidades_por_caixa, ativo)
SELECT 
    id AS product_id,
    'SKU-' || LPAD(id::text, 4, '0') AS codigo_integracao,
    CASE 
        WHEN type = 'Cápsula' THEN 0.0500
        WHEN type = 'Drip' THEN 0.1000
        WHEN type = 'Grão' THEN 0.2500
        WHEN type = 'Moído' AND weight = '250g' THEN 0.2500
        WHEN type = 'Moído' AND weight = '500g' THEN 0.5000
        ELSE 0.2500
    END AS peso_embalagem_kg,
    CASE 
        WHEN type = 'Cápsula' THEN 12
        WHEN type = 'Drip' THEN 12
        WHEN type = 'Grão' THEN 20
        WHEN type = 'Moído' AND weight = '250g' THEN 20
        WHEN type = 'Moído' AND weight = '500g' THEN 10
        ELSE 20
    END AS unidades_por_caixa,
    true AS ativo
FROM public.products
ON CONFLICT (product_id) DO NOTHING;
`;

async function run() {
  console.log('Trying execute_sql RPC...');
  const { data, error } = await supabase.rpc('execute_sql', { query: sql });
  if (error) {
    console.error('execute_sql RPC failed:', error);
  } else {
    console.log('execute_sql RPC success:', data);
  }
}

run().catch(console.error);
