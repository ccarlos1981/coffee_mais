-- Create a table to store Trade Annual Calendar events and birthdays
CREATE TABLE IF NOT EXISTS public.cm_trade_calendario_anual (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    assunto VARCHAR(255) NOT NULL,
    observacao TEXT,
    gerente VARCHAR(255),
    regiao VARCHAR(100),
    ano INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by VARCHAR(255)
);

-- Enable RLS
ALTER TABLE public.cm_trade_calendario_anual ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read, insert, update, and delete
CREATE POLICY "Enable read access for all users" ON public.cm_trade_calendario_anual FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.cm_trade_calendario_anual FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.cm_trade_calendario_anual FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.cm_trade_calendario_anual FOR DELETE USING (true);
