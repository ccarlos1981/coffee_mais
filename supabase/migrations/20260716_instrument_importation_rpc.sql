-- Migration to instrument the billing import RPC and materialized views refresh with telemetry logging
CREATE OR REPLACE FUNCTION public.confirmar_importacao_faturamento(p_batch_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_period_start date;
  v_period_end date;
  v_rows_promoted integer := 0;
  v_log_source text;
  
  -- Telemetry variables
  v_stage text := 'init';
  v_stage_start timestamptz;
  v_stage_end timestamptz;
  v_duration interval;
  r RECORD;
BEGIN
  -- 0. Configurar timeout e obter info do log
  v_stage := '0. setup and get log info';
  v_stage_start := clock_timestamp();
  BEGIN
    -- Aumentar timeout da transação para 2 minutos (120000 ms) para contornar o limite de 8s do Postgrest
    PERFORM set_config('statement_timeout', '120000', true);

    SELECT period_start, period_end, source 
    INTO v_period_start, v_period_end, v_log_source
    FROM cm_sync_logs
    WHERE id = p_batch_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Lote de importação não encontrado.';
    END IF;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 1. Disable triggers on cm_faturamento
  v_stage := '1. disable trigger';
  v_stage_start := clock_timestamp();
  BEGIN
    ALTER TABLE cm_faturamento DISABLE TRIGGER USER;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento', 'base_atendimento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 2. Create affected_partners_temp table
  v_stage := '2. temp table affected partners';
  v_stage_start := clock_timestamp();
  BEGIN
    CREATE TEMP TABLE affected_partners_temp ON COMMIT DROP AS
    SELECT DISTINCT cod_parceiro 
    FROM (
      SELECT DISTINCT cod_parceiro 
      FROM cm_faturamento 
      WHERE p_mode = 'replace' 
        AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL
        AND dt_faturamento >= date_trunc('month', v_period_start)::date 
        AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date
        AND cod_parceiro IS NOT NULL
      UNION
      SELECT DISTINCT cod_parceiro 
      FROM cm_faturamento_staging 
      WHERE batch_id = p_batch_id
        AND cod_parceiro IS NOT NULL
    ) t
    WHERE cod_parceiro IN (SELECT cod_parceiro FROM public.base_atendimento);

    ANALYZE affected_partners_temp;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento', 'base_atendimento', 'cm_faturamento_staging') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 3. Delete replace (if mode is replace)
  v_stage := '3. delete replace';
  v_stage_start := clock_timestamp();
  BEGIN
    IF p_mode = 'replace' AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL THEN
      DELETE FROM cm_faturamento 
      WHERE dt_faturamento >= date_trunc('month', v_period_start)::date 
        AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date;
    END IF;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 4. Insert into cm_faturamento
  v_stage := '4. insert cm_faturamento';
  v_stage_start := clock_timestamp();
  BEGIN
    INSERT INTO cm_faturamento (
      origem, batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
      cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
      vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
      custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
      cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
      vlr_total_st, cod_cr, centro_resultado
    )
    SELECT 
      'EXCEL', p_batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
      cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
      vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
      custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
      cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
      vlr_total_st, cod_cr, centro_resultado
    FROM cm_faturamento_staging
    WHERE batch_id = p_batch_id;

    GET DIAGNOSTICS v_rows_promoted = ROW_COUNT;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento', 'cm_faturamento_staging') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 5. Delete staging
  v_stage := '5. delete staging';
  v_stage_start := clock_timestamp();
  BEGIN
    DELETE FROM cm_faturamento_staging
    WHERE batch_id = p_batch_id;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento_staging') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 6. Enable triggers on cm_faturamento
  v_stage := '6. enable trigger';
  v_stage_start := clock_timestamp();
  BEGIN
    ALTER TABLE cm_faturamento ENABLE TRIGGER USER;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('cm_faturamento', 'base_atendimento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 7. Update faturamento_mensal
  v_stage := '7. update faturamento_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    UPDATE public.base_atendimento b
    SET faturamento_mensal = COALESCE(s.avg_total_mes, 0.00)
    FROM (
      WITH partner_monthly_sums AS (
        SELECT
          cod_parceiro,
          SUM(vlr_total_liq) as total_mes
        FROM public.cm_faturamento
        WHERE cod_parceiro IN (SELECT cod_parceiro FROM affected_partners_temp)
          AND dt_faturamento < date_trunc('month', CURRENT_DATE)
        GROUP BY cod_parceiro, date_trunc('month', dt_faturamento)
      )
      SELECT 
        cod_parceiro, 
        AVG(total_mes) as avg_total_mes 
      FROM partner_monthly_sums
      GROUP BY cod_parceiro
    ) s
    WHERE b.cod_parceiro = s.cod_parceiro;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('base_atendimento', 'cm_clientes', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: batch=%, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                p_batch_id, v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 8. Update log success
  v_stage := '8. update log success';
  v_stage_start := clock_timestamp();
  BEGIN
    UPDATE cm_sync_logs
    SET 
      status = 'SUCCESS',
      finished_at = now(),
      rows_inserted = v_rows_promoted,
      rows_fetched = v_rows_promoted
    WHERE id = p_batch_id;
    
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: batch=%, etapa=%, inicio=%, fim=%, duracao=%', p_batch_id, v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA ERROR: batch=%, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', p_batch_id, v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'rowsPromoted', v_rows_promoted
  );
EXCEPTION WHEN OTHERS THEN
  -- Certificar que triggers são reativados mesmo em caso de falha catastrófica de bloco não tratado
  BEGIN
    ALTER TABLE cm_faturamento ENABLE TRIGGER USER;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RAISE;
END;
$function$;


-- Also instrumenting the refresh_materialized_views function
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_stage text;
  v_stage_start timestamptz;
  v_stage_end timestamptz;
  v_duration interval;
  r RECORD;
BEGIN
  -- 1. Refresh mv_vendas_mensal
  v_stage := '1. refresh mv_vendas_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_mensal;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('mv_vendas_mensal', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: view_refresh, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 2. Refresh mv_vendas_cliente_mensal
  v_stage := '2. refresh mv_vendas_cliente_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendas_cliente_mensal;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('mv_vendas_cliente_mensal', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: view_refresh, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;

  -- 3. Refresh mv_positivacao_sku_mensal
  v_stage := '3. refresh mv_positivacao_sku_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    REFRESH MATERIALIZED VIEW mv_positivacao_sku_mensal;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('mv_positivacao_sku_mensal', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: view_refresh, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
    RAISE;
  END;
END;
$function$;
