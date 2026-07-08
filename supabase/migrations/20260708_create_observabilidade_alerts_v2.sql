-- Migration created on 2026-07-08 for proactive observability alerts check v2 (Capacity Planning)

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
  
  -- Operator cursor variables
  r_operator RECORD;
  v_op_aprovadas_dia INT;
  v_op_reprovadas_dia INT;
  v_op_sla_medio INTERVAL;
  v_op_taxa_retrabalho NUMERIC;
  v_op_semanal INT;
  v_op_mensal INT;
  v_op_sla_hours NUMERIC;
  v_op_status_color TEXT;
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

  -- 3. Trade Team Capacity Checks
  FOR r_operator IN 
    SELECT DISTINCT usuario FROM public.cm_investimento_familias_history WHERE usuario IS NOT NULL AND usuario != 'unknown'
  LOOP
    -- Daily Aprovadas
    SELECT count(*) INTO v_op_aprovadas_dia
    FROM public.cm_investimento_familias_history
    WHERE usuario = r_operator.usuario AND status_novo = 'APROVADA' AND data_hora >= NOW() - INTERVAL '24 hours';

    -- Daily Reprovadas
    SELECT count(*) INTO v_op_reprovadas_dia
    FROM public.cm_investimento_familias_history
    WHERE usuario = r_operator.usuario AND status_novo = 'REPROVADA' AND data_hora >= NOW() - INTERVAL '24 hours';

    -- SLA Medio
    SELECT COALESCE(AVG(h.data_hora - f.created_at), '00:00:00'::interval) INTO v_op_sla_medio
    FROM public.cm_investimento_familias_history h
    JOIN public.cm_investimento_familias f ON h.familia_id = f.id
    WHERE h.usuario = r_operator.usuario AND h.status_novo = 'APROVADA';

    v_op_sla_hours := EXTRACT(EPOCH FROM v_op_sla_medio) / 3600;

    -- Rework rate
    SELECT 
      COALESCE((count(*) FILTER (WHERE status_novo = 'REPROVADA')::numeric / NULLIF(count(*), 0)) * 100, 0) INTO v_op_taxa_retrabalho
    FROM public.cm_investimento_familias_history
    WHERE usuario = r_operator.usuario;

    -- Weekly Productivity
    SELECT count(*) INTO v_op_semanal
    FROM public.cm_investimento_familias_history
    WHERE usuario = r_operator.usuario AND data_hora >= NOW() - INTERVAL '7 days';

    -- Monthly Productivity
    SELECT count(*) INTO v_op_mensal
    FROM public.cm_investimento_familias_history
    WHERE usuario = r_operator.usuario AND data_hora >= NOW() - INTERVAL '30 days';

    -- Status classification
    v_op_status_color := CASE 
      WHEN v_op_sla_hours <= 24 THEN '🟢 Excelente'
      WHEN v_op_sla_hours <= 72 THEN '🟡 Atenção'
      WHEN v_op_sla_hours <= 120 THEN '🟠 Risco'
      ELSE '🔴 Crítico'
    END;

    -- Write capacity log
    INSERT INTO public.cm_audit_logs (action, table_name, new_data)
    VALUES (
      'Acesso',
      'cm_investimento_familias_history',
      jsonb_build_object(
        'event_type', 'TRADE_CAPACITY_STATUS',
        'operador', r_operator.usuario,
        'aprovadas_dia', v_op_aprovadas_dia,
        'reprovadas_dia', v_op_reprovadas_dia,
        'sla_medio_horas', v_op_sla_hours,
        'taxa_retrabalho_percentual', v_op_taxa_retrabalho,
        'produtividade_semanal', v_op_semanal,
        'produtividade_mensal', v_op_mensal,
        'sla_status', v_op_status_color,
        'backlog_estimado_global', v_pending_count
      )
    );
  END LOOP;

  -- 4. Health Classification logger
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
