-- Migration created on 2026-07-08 for cm_investimento_familias performance indexes

CREATE INDEX IF NOT EXISTS idx_cm_investimento_familias_status
ON public.cm_investimento_familias(status);

CREATE INDEX IF NOT EXISTS idx_cm_investimento_familias_aprovado_em
ON public.cm_investimento_familias(aprovado_em DESC);

CREATE INDEX IF NOT EXISTS idx_cm_investimento_familias_created_at
ON public.cm_investimento_familias(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cm_investimento_familias_history_date
ON public.cm_investimento_familias_history(data_hora DESC);
