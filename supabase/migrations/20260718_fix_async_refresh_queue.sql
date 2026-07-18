-- Migration: 20260718_fix_async_refresh_queue.sql
-- Description: Corrige a fila de refresh assíncrona para apontar exclusivamente para a nova view materializada física mv_vendas_agg,
--              evitando falhas de execução já que as antigas views analíticas agora são views lógicas dinâmicas.

CREATE OR REPLACE FUNCTION public.fn_process_mv_refresh_queue()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_batch_id UUID;
  v_started TIMESTAMP WITH TIME ZONE;
  v_finished TIMESTAMP WITH TIME ZONE;
  v_rows_processed BIGINT := 0;
  v_divergence_pct NUMERIC := 0.00;
  v_has_alert BOOLEAN := FALSE;
BEGIN
  -- 1. Single Refresh Rule: abort if another job is already RUNNING
  IF EXISTS (SELECT 1 FROM public.cm_mv_refresh_jobs WHERE status = 'RUNNING') THEN
    RAISE WARNING 'TELEMETRIA ASYNC: Outro refresh ja esta em execucao. Abortando.';
    RETURN FALSE;
  END IF;

  -- 2. Select oldest PENDING job
  SELECT id, batch_id INTO v_job_id, v_batch_id
  FROM public.cm_mv_refresh_jobs
  WHERE status = 'PENDING'
  ORDER BY requested_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 3. Set status to RUNNING
  v_started := clock_timestamp();
  UPDATE public.cm_mv_refresh_jobs
  SET status = 'RUNNING', started_at = v_started
  WHERE id = v_job_id;

  RAISE LOG 'TELEMETRIA ASYNC: Iniciando processamento do job % para batch %', v_job_id, v_batch_id;

  BEGIN
    -- 4. Execute concurrently (atualiza apenas a view materializada base física)
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_agg;

    v_finished := clock_timestamp();

    -- 5. Calculate rows processed
    IF v_batch_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_rows_processed FROM public.cm_faturamento WHERE batch_id = v_batch_id;
    ELSE
      SELECT COUNT(*) INTO v_rows_processed 
      FROM public.cm_faturamento 
      WHERE dt_faturamento >= date_trunc('month', CURRENT_DATE) 
        AND dt_faturamento < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month';
    END IF;

    -- 6. Recalculate health checks and divergence
    SELECT COALESCE(MAX(diff_pct), 0.00), EXISTS(SELECT 1 FROM public.vw_mv_health_check WHERE status = 'ALERT')
    INTO v_divergence_pct, v_has_alert
    FROM public.vw_mv_health_check;

    -- 7. Audit Alert if divergence > 0.5% (atualizado table_name para mv_vendas_agg)
    IF v_has_alert THEN
      INSERT INTO public.cm_audit_logs (table_name, action, new_data)
      VALUES (
        'mv_vendas_agg',
        'UPDATE',
        jsonb_build_object(
          'alert_type', 'HEALTH_ALERT',
          'message', 'Divergencia entre Materialized Views e Camada Comercial excede 0.5% apos o refresh da base.',
          'divergence_pct', v_divergence_pct,
          'job_id', v_job_id,
          'batch_id', v_batch_id,
          'checked_at', v_finished
        )
      );
      RAISE WARNING 'TELEMETRIA ASYNC HEALTH ALERT: Divergencia detectada de %', v_divergence_pct;
    END IF;

    -- 8. Save success stats
    UPDATE public.cm_mv_refresh_jobs
    SET status = 'SUCCESS',
        finished_at = v_finished,
        duration_seconds = EXTRACT(EPOCH FROM (v_finished - v_started)),
        rows_processed = v_rows_processed,
        divergence_pct = v_divergence_pct,
        error_message = NULL
    WHERE id = v_job_id;

    RAISE LOG 'TELEMETRIA ASYNC SUCCESS: Job % concluido em %s', v_job_id, EXTRACT(EPOCH FROM (v_finished - v_started));
    RETURN TRUE;

  EXCEPTION WHEN OTHERS THEN
    v_finished := clock_timestamp();
    
    -- Save error stats
    UPDATE public.cm_mv_refresh_jobs
    SET status = 'ERROR',
        finished_at = v_finished,
        duration_seconds = EXTRACT(EPOCH FROM (v_finished - v_started)),
        error_message = SQLERRM
    WHERE id = v_job_id;

    RAISE LOG 'TELEMETRIA ASYNC ERROR: Job % falhou: %', v_job_id, SQLERRM;
    RETURN FALSE;
  END;
END;
$$;
