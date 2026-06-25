-- Migration: Sprint 4.5 Performance Tuning
-- Description: Drop simple indexes and establish composite indexes for optimal query speeds.

-- 1. Clean up duplicate or simple indexes if they exist
DROP INDEX IF EXISTS public.idx_cm_promotor_heartbeat_log_created_at;
DROP INDEX IF EXISTS public.idx_cm_promotor_heartbeat_log_promotor_id;
DROP INDEX IF EXISTS public.idx_cm_mobile_app_logs_created_at;
DROP INDEX IF EXISTS public.idx_cm_mobile_feedback_created_at;
DROP INDEX IF EXISTS public.idx_heartbeat_promotor_created;

-- 2. Establish composite indexes
CREATE INDEX IF NOT EXISTS idx_cm_promotor_heartbeat_log_promotor_created ON public.cm_promotor_heartbeat_log(promotor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_mobile_app_logs_promotor_created ON public.cm_mobile_app_logs(promotor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_mobile_feedback_promotor_created ON public.cm_mobile_feedback(promotor_id, created_at DESC);

-- 3. Additional helper indexes for other CommandCenter queries
CREATE INDEX IF NOT EXISTS idx_cm_promotor_jornada_created_at ON public.cm_promotor_jornada(created_at);
CREATE INDEX IF NOT EXISTS idx_cm_promotor_visita_checkin_servidor ON public.cm_promotor_visita(checkin_servidor);
