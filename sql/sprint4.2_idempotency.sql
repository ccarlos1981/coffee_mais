-- Sprint 4.2 Idempotency Migration
-- Adiciona colunas client_action_id e respectivos índices únicos parciais para evitar duplicidade de sincronização offline.

ALTER TABLE public.cm_promotor_jornada ADD COLUMN IF NOT EXISTS client_action_id UUID;
ALTER TABLE public.cm_promotor_visita ADD COLUMN IF NOT EXISTS checkin_client_action_id UUID;
ALTER TABLE public.cm_promotor_visita ADD COLUMN IF NOT EXISTS checkout_client_action_id UUID;
ALTER TABLE public.cm_promotor_visita_ocorrencia ADD COLUMN IF NOT EXISTS client_action_id UUID;
ALTER TABLE public.cm_promotor_visita_foto ADD COLUMN IF NOT EXISTS client_action_id UUID;
ALTER TABLE public.cm_trade_missao_execucao ADD COLUMN IF NOT EXISTS client_action_id UUID;

-- Índices únicos parciais para proteção contra valores NULL (Ajuste 1 e 2)
ALTER TABLE public.cm_promotor_jornada DROP CONSTRAINT IF EXISTS cm_promotor_jornada_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_promotor_jornada_client_action_id 
ON public.cm_promotor_jornada (client_action_id) 
WHERE client_action_id IS NOT NULL;

ALTER TABLE public.cm_promotor_visita DROP CONSTRAINT IF EXISTS cm_promotor_visita_checkin_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_promotor_visita_checkin_client_action_id 
ON public.cm_promotor_visita (checkin_client_action_id) 
WHERE checkin_client_action_id IS NOT NULL;

ALTER TABLE public.cm_promotor_visita DROP CONSTRAINT IF EXISTS cm_promotor_visita_checkout_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_promotor_visita_checkout_client_action_id 
ON public.cm_promotor_visita (checkout_client_action_id) 
WHERE checkout_client_action_id IS NOT NULL;

ALTER TABLE public.cm_promotor_visita_ocorrencia DROP CONSTRAINT IF EXISTS cm_promotor_visita_ocorrencia_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_promotor_visita_ocorrencia_client_action_id 
ON public.cm_promotor_visita_ocorrencia (client_action_id) 
WHERE client_action_id IS NOT NULL;

ALTER TABLE public.cm_promotor_visita_foto DROP CONSTRAINT IF EXISTS cm_promotor_visita_foto_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_promotor_visita_foto_client_action_id 
ON public.cm_promotor_visita_foto (client_action_id) 
WHERE client_action_id IS NOT NULL;

ALTER TABLE public.cm_trade_missao_execucao DROP CONSTRAINT IF EXISTS cm_trade_missao_execucao_client_action_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cm_trade_missao_execucao_client_action_id 
ON public.cm_trade_missao_execucao (client_action_id) 
WHERE client_action_id IS NOT NULL;
