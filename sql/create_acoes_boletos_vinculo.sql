-- Create a table to link multiple boletos to a single investment action with partial values
CREATE TABLE IF NOT EXISTS public.cm_acoes_boletos_vinculo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    acao_id UUID REFERENCES public.cm_acoes_investimento(id) ON DELETE CASCADE,
    boleto_id UUID REFERENCES public.cm_boletos(id) ON DELETE CASCADE,
    valor_associado NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(acao_id, boleto_id)
);

-- Enable RLS
ALTER TABLE public.cm_acoes_boletos_vinculo ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read, insert, update, and delete links
CREATE POLICY "Enable read access for all users" ON public.cm_acoes_boletos_vinculo FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.cm_acoes_boletos_vinculo FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.cm_acoes_boletos_vinculo FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.cm_acoes_boletos_vinculo FOR DELETE USING (true);
