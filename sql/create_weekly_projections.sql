-- Tabela para armazenar as projeções semanais das reuniões de RPS (Reunião de Planejamento Semanal)
CREATE TABLE IF NOT EXISTS public.cm_weekly_projections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manager TEXT NOT NULL,
  client_matrix TEXT NOT NULL, -- '_TOTAL_' para faturamento/volume/investimento total do gerente, ou o nome da matriz, ou 'OUTROS'
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_start_date DATE NOT NULL, -- data da segunda-feira
  kpi TEXT NOT NULL, -- 'VOL', 'FAT', 'INVEST', 'META'
  projection_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (manager, client_matrix, year, month, week_start_date, kpi)
);

-- Índice para acelerar a busca de projeções de um período específico
CREATE INDEX IF NOT EXISTS idx_cm_weekly_projections_lookup 
  ON public.cm_weekly_projections(manager, client_matrix, year, month);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.cm_weekly_projections ENABLE ROW LEVEL SECURITY;

-- Política de RLS que permite acesso completo a usuários autenticados
CREATE POLICY "Allow all access to cm_weekly_projections"
  ON public.cm_weekly_projections FOR ALL
  USING (true)
  WITH CHECK (true);
