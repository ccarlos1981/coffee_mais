-- Migration para Hub de Ações Inteligentes (Smart Action Hub)
-- Tabelas baseadas em UUID, com vinculação de PDV e apontamento histórico.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela Principal de Alertas Gerados (client_alerts)
CREATE TABLE IF NOT EXISTS public.cm_client_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_name TEXT NOT NULL,
    manager TEXT,
    fat_current NUMERIC(12, 2) DEFAULT 0,
    fat_previous NUMERIC(12, 2) DEFAULT 0,
    drop_pct NUMERIC(5, 2) DEFAULT 0,
    alert_type TEXT DEFAULT 'CHURN_RISK', -- Pode ser MILD_DROP, CHURN_RISK, etc
    status TEXT DEFAULT 'PENDING',        -- PENDING, TACKLED, RESOLVED, DISMISSED
    alert_month TEXT NOT NULL,            -- Identificador do ciclo "2026-04" para unicidade
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE (client_name, alert_month)     -- Impede que o mesmo cliente tenha dois alertas no mesmo mês se já gerado
);

-- Habilitando RLS genérico inicial
ALTER TABLE public.cm_client_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all authenticated users" ON public.cm_client_alerts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users" ON public.cm_client_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all authenticated users" ON public.cm_client_alerts FOR UPDATE USING (true);

-- 2. Tabela de Registros de Ações e Histórico (action_notes)
CREATE TABLE IF NOT EXISTS public.cm_action_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES public.cm_client_alerts(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    note TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.cm_action_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all authenticated users on actions" ON public.cm_action_notes FOR SELECT USING (true);
CREATE POLICY "Enable insert for all authenticated users on actions" ON public.cm_action_notes FOR INSERT WITH CHECK (true);

-- Indexes para otimização de buscas
CREATE INDEX IF NOT EXISTS idx_client_alerts_manager ON public.cm_client_alerts (manager);
CREATE INDEX IF NOT EXISTS idx_client_alerts_status ON public.cm_client_alerts (status);
CREATE INDEX IF NOT EXISTS idx_action_notes_alert_id ON public.cm_action_notes (alert_id);
