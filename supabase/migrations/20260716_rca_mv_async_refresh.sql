-- Migration: Architecture Hardening - Async Materialized View Refresh
-- Date: 16/07/2026

-- 1. Create Refresh Jobs Fila Table
CREATE TABLE IF NOT EXISTS public.cm_mv_refresh_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID,
  status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT clock_timestamp() NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  duration_seconds NUMERIC,
  rows_processed BIGINT,
  divergence_pct NUMERIC,
  error_message TEXT,
  CONSTRAINT chk_job_status CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR'))
);

-- 2. Queue Deduplication Rule Index
-- Only one PENDING or RUNNING job is allowed at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_refresh_jobs 
ON public.cm_mv_refresh_jobs (status) 
WHERE status IN ('PENDING', 'RUNNING');

-- 3. Queue Enqueue Function
CREATE OR REPLACE FUNCTION public.fn_enqueue_mv_refresh(p_batch_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.cm_mv_refresh_jobs (batch_id, status)
  VALUES (p_batch_id, 'PENDING')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Grant permissions for enqueue function
GRANT EXECUTE ON FUNCTION public.fn_enqueue_mv_refresh(UUID) TO anon, authenticated, service_role;

-- 4. Health Check View (aligned with MyMetrics logic)
CREATE OR REPLACE VIEW public.vw_mv_health_check AS
WITH oficial_monthly AS (
  SELECT 
    to_char(f.dt_faturamento, 'YYYY-MM') as mes,
    SUM(
      CASE 
        WHEN f.cod_top IN ('1200', '1201') THEN -ABS(f.vlr_total_liq)
        ELSE f.vlr_total_liq
      END
    ) as sum_val
  FROM public.cm_faturamento f
  LEFT JOIN public.base_atendimento b ON b.cod_parceiro = f.cod_parceiro
  WHERE (f.status_nfe IS NULL OR f.status_nfe <> 'CANCELADA')
    AND f.nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
    AND (
      f.cod_top IN ('1100', '1200', '1201', '1703', '1713', '1723')
      OR (f.cod_top = '1117' AND (b.canal = 'KA' OR f.nome_vendedor IN ('SHOPIFY', 'LIVELO') OR f.nome_parceiro = 'BEATRIZ FERNANDA NEVES'))
    )
  GROUP BY 1
),
mv_monthly AS (
  SELECT mes, SUM(fat) as sum_val
  FROM public.mv_vendas_mensal
  GROUP BY mes
)
SELECT 
  COALESCE(o.mes, m.mes) as mes,
  COALESCE(m.sum_val, 0) as mv_fat,
  COALESCE(o.sum_val, 0) as oficial_fat,
  ABS(COALESCE(o.sum_val, 0) - COALESCE(m.sum_val, 0)) as diff_abs,
  CASE 
    WHEN COALESCE(o.sum_val, 0) = 0 THEN 0 
    ELSE ROUND((ABS(COALESCE(o.sum_val, 0) - COALESCE(m.sum_val, 0)) / COALESCE(o.sum_val, 0) * 100)::numeric, 4)
  END as diff_pct,
  (SELECT MAX(finished_at) FROM public.cm_mv_refresh_jobs WHERE status = 'SUCCESS') as last_refresh_at,
  EXTRACT(EPOCH FROM (clock_timestamp() - (SELECT COALESCE(MAX(finished_at), clock_timestamp() - INTERVAL '1 day') FROM public.cm_mv_refresh_jobs WHERE status = 'SUCCESS')))/60 as age_minutes,
  CASE 
    WHEN CASE WHEN COALESCE(o.sum_val, 0) = 0 THEN 0 ELSE (ABS(COALESCE(o.sum_val, 0) - COALESCE(m.sum_val, 0)) / COALESCE(o.sum_val, 0) * 100) END > 0.5 THEN 'ALERT'
    ELSE 'OK'
  END as status
FROM oficial_monthly o
FULL OUTER JOIN mv_monthly m ON o.mes = m.mes
WHERE COALESCE(o.mes, m.mes) >= to_char(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM');

-- 5. Queue Processor Function (Single Refresh Rule, Telemetry and Health Checks)
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
    -- 4. Execute concurrently
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_mensal;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_cliente_mensal;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_positivacao_sku_mensal;

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

    -- 7. Audit Alert if divergence > 0.5%
    IF v_has_alert THEN
      INSERT INTO public.cm_audit_logs (table_name, action, new_data)
      VALUES (
        'mv_vendas_mensal',
        'UPDATE',
        jsonb_build_object(
          'alert_type', 'HEALTH_ALERT',
          'message', 'Divergencia entre Materialized Views e Camada Comercial excede 0.5% apos o refresh.',
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
        divergence_pct = v_divergence_pct
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

GRANT EXECUTE ON FUNCTION public.fn_process_mv_refresh_queue() TO anon, authenticated, service_role;

-- 6. Setup pg_cron Scheduler (Nivel 1)
-- Check and process every minute
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process_mv_refresh_queue_cron';
SELECT cron.schedule('process_mv_refresh_queue_cron', '* * * * *', 'SELECT public.fn_process_mv_refresh_queue();');

-- 7. Orphan Partners Report View (Manager 9999)
CREATE OR REPLACE VIEW public.vw_orphan_partners_report AS
SELECT 
  s.cod_parceiro,
  s.nome_parceiro,
  SUM(s.net_value) as faturamento,
  s.uf,
  COALESCE(
    (SELECT b.manager 
     FROM public.base_atendimento b 
     WHERE b.rede IS NOT NULL 
       AND s.nome_parceiro ILIKE '%' || b.rede || '%' 
       AND b.manager IS NOT NULL 
     LIMIT 1),
    CASE 
      WHEN s.uf IN ('RS', 'SC', 'PR') THEN 'Leandro Saffi'
      WHEN s.uf IN ('SP', 'RJ', 'ES', 'MG') THEN 'Luiz'
      ELSE 'Inside Sales'
    END
  ) as sugestao_owner,
  'Faturamento Sem Cadastro em base_atendimento'::text as origem_classificacao
FROM public.sales s
WHERE s.manager_id = '9999'
  AND s.invoice_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
GROUP BY s.cod_parceiro, s.nome_parceiro, s.uf;

GRANT SELECT ON public.vw_orphan_partners_report TO anon, authenticated, service_role;
GRANT SELECT ON public.vw_mv_health_check TO anon, authenticated, service_role;
