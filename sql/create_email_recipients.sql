-- Migration para Módulo de PDF Diário
-- Controla a lista VIP de destinatários do Relatório do CEO

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.cm_report_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.cm_report_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable ALL for all authenticated users" ON public.cm_report_recipients FOR ALL USING (true);
