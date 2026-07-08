-- Migration created on 2026-07-08 for proactive observability alerts check (Constraint Compliant)

CREATE OR REPLACE FUNCTION public.check_investimentos_observabilidade_alerts()
RETURNS void AS $$
DECLARE
  v_pending_count INT;
  v_avg_approval_time INTERVAL;
  v_stale_count INT;
  v_history_count INT;
  v_families_count INT;
  v_audit_daily_growth INT;
  v_active_alerts INT := 0;
  v_details JSONB := '{}'::jsonb;
BEGIN
  -- 1. Trade Backlog Checks
  SELECT count(*) INTO v_pending_count
  FROM public.cm_investimento_familias
  WHERE status = 'PENDENTE';

  SELECT COALESCE(AVG(aprovado_em - created_at), '00:00:00'::interval) INTO v_avg_approval_time
  FROM public.cm_investimento_familias
  WHERE status = 'APROVADA' AND aprovado_em IS NOT NULL;

  SELECT count(*) INTO v_stale_count
  FROM public.cm_acoes_investimento
  WHERE fase_atual = 2 AND updated_at < NOW() - INTERVAL '7 days';

  IF v_pending_count > 50 OR v_avg_approval_time > INTERVAL '72 hours' OR v_stale_count > 0 THEN
    v_active_alerts := v_active_alerts + 1;
    INSERT INTO public.cm_audit_logs (action, table_name, new_data)
    VALUES (
      'Acesso', 
      'cm_investimento_familias', 
      jsonb_build_object(
        'event_type', 'TRADE_BACKLOG_ALERT',
        'pending_families', v_pending_count,
        'avg_approval_time_hours', EXTRACT(EPOCH FROM v_avg_approval_time) / 3600,
        'stale_investments_count', v_stale_count,
        'severity', 'WARNING'
      )
    );
  END IF;

  -- 2. Crescimento de Auditoria Checks
  SELECT count(*) INTO v_history_count FROM public.cm_investimento_familias_history;
  SELECT count(*) INTO v_families_count FROM public.cm_investimento_familias;
  
  SELECT count(*) INTO v_audit_daily_growth
  FROM public.cm_audit_logs
  WHERE created_at > NOW() - INTERVAL '24 hours';

  -- History table size > 10x families table size, or daily audit logs > 1000 records
  IF (v_history_count > v_families_count * 10 AND v_families_count > 0) OR v_audit_daily_growth > 1000 THEN
    v_active_alerts := v_active_alerts + 1;
    INSERT INTO public.cm_audit_logs (action, table_name, new_data)
    VALUES (
      'Acesso',
      'cm_audit_logs',
      jsonb_build_object(
        'event_type', 'AUDIT_GROWTH_ALERT',
        'history_rows', v_history_count,
        'families_rows', v_families_count,
        'daily_audit_growth', v_audit_daily_growth,
        'severity', 'CRITICAL'
      )
    );
  END IF;

  -- 3. Health Classification logger
  -- Log daily overall health status based on active alerts count
  INSERT INTO public.cm_audit_logs (action, table_name, new_data)
  VALUES (
    'Acesso',
    'cm_acoes_investimento',
    jsonb_build_object(
      'event_type', 'HEALTH_STATUS_LOG',
      'active_alerts', v_active_alerts,
      'status_color', CASE 
        WHEN v_active_alerts = 0 THEN '🟢 Saudável'
        WHEN v_active_alerts <= 3 THEN '🟡 Atenção'
        WHEN v_active_alerts <= 10 THEN '🟠 Risco'
        ELSE '🔴 Crítico'
      END,
      'checked_at', NOW()
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Schedule the cron job to check alerts daily
-- Note: pg_cron must be enabled in your Supabase project (extensions tab)
SELECT cron.schedule(
  'check-investimentos-alerts-daily',
  '0 0 * * *',
  'SELECT public.check_investimentos_observabilidade_alerts();'
);
