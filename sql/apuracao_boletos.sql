-- Create Boletos table
CREATE TABLE IF NOT EXISTS public.cm_boletos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rede TEXT NOT NULL,
    numero_boleto TEXT NOT NULL,
    valor_total NUMERIC NOT NULL,
    vencimento DATE NOT NULL,
    status TEXT DEFAULT 'Aberto' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on cm_boletos
ALTER TABLE public.cm_boletos ENABLE ROW LEVEL SECURITY;

-- Allow all for now (matching other tables usually)
CREATE POLICY "Enable read access for all users" ON public.cm_boletos FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.cm_boletos FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.cm_boletos FOR UPDATE USING (true);

-- Add fields to cm_acoes_investimento for Apuração
ALTER TABLE public.cm_acoes_investimento
ADD COLUMN IF NOT EXISTS apuracao_numero_acordo TEXT,
ADD COLUMN IF NOT EXISTS apuracao_qtd_vendida INTEGER,
ADD COLUMN IF NOT EXISTS apuracao_valor_realizado NUMERIC,
ADD COLUMN IF NOT EXISTS apuracao_evidencias_url TEXT,
ADD COLUMN IF NOT EXISTS apuracao_boleto_id UUID REFERENCES public.cm_boletos(id) ON DELETE SET NULL;
