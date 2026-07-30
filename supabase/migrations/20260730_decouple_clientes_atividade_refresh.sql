-- ======================================================================
-- MIGRATION: 20260730_decouple_clientes_atividade_refresh.sql
-- DESCRIÇÃO: Desacopla o recálculo de cm_clientes_atividade do fluxo síncrono
--            Adiciona tabela de jobs, advisory lock e RPC de reexecução manual
-- ======================================================================

-- 1. Criar Tabela de Telemetria de Jobs de Atividade
CREATE TABLE IF NOT EXISTS public.cm_clientes_atividade_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR')),
  trigger_source TEXT NOT NULL DEFAULT 'IMPORT_JOB',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  duration_seconds NUMERIC NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Criar índice para busca rápida de jobs pendentes ou por batch
CREATE INDEX IF NOT EXISTS idx_clientes_atividade_jobs_status ON public.cm_clientes_atividade_jobs(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_clientes_atividade_jobs_batch ON public.cm_clientes_atividade_jobs(batch_id);

-- 2. Atualizar a RPC refresh_materialized_views() para REMOVER a chamada síncrona
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
  -- 1. Refresh mv_vendas_agg (se existir)
  v_stage := '1. refresh mv_vendas_agg';
  v_stage_start := clock_timestamp();
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_vendas_agg') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_agg;
    END IF;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
  END;

  -- 2. Refresh mv_vendas_mensal (se existir)
  v_stage := '2. refresh mv_vendas_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_vendas_mensal') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_vendas_mensal;
    END IF;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
  END;

  -- 3. Refresh mv_positivacao_sku_mensal (se existir)
  v_stage := '3. refresh mv_positivacao_sku_mensal';
  v_stage_start := clock_timestamp();
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_positivacao_sku_mensal') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_positivacao_sku_mensal;
    END IF;
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
  EXCEPTION WHEN OTHERS THEN
    v_stage_end := clock_timestamp();
    v_duration := v_stage_end - v_stage_start;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
  END;

  -- NOTA: O refresh_clientes_atividade() foi desacoplado deste bloco síncrono
  -- e passa a rodar via fn_process_clientes_atividade_queue() em segundo plano.
END;
$function$;

-- 3. Criar Worker Assíncrono com Advisory Lock para Processamento da Fila de Atividade
CREATE OR REPLACE FUNCTION public.fn_process_clientes_atividade_queue()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_lock_key bigint := hashtext('clientes_atividade_refresh_lock');
  v_lock_obtained boolean := false;
  v_job_id uuid;
  v_batch_id uuid;
  v_started timestamptz;
  v_finished timestamptz;
  v_duration numeric;
BEGIN
  -- A. Tentar obter o Advisory Lock sem bloquear
  v_lock_obtained := pg_try_advisory_lock(v_lock_key);
  IF NOT v_lock_obtained THEN
    RAISE LOG 'TELEMETRIA CLIENTES_ATIVIDADE: Outro refresh ja esta em execucao (LOCK_ACTIVE). Abortando requisição duplicada.';
    RETURN false;
  END IF;

  BEGIN
    -- B. Selecionar o job PENDING mais antigo
    SELECT id, batch_id INTO v_job_id, v_batch_id
    FROM public.cm_clientes_atividade_jobs
    WHERE status = 'PENDING'
    ORDER BY requested_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NULL THEN
      -- Nenhum job pendente
      PERFORM pg_advisory_unlock(v_lock_key);
      RETURN false;
    END IF;

    -- C. Atualizar status para RUNNING e registrar horário de início
    v_started := clock_timestamp();
    UPDATE public.cm_clientes_atividade_jobs
    SET status = 'RUNNING',
        started_at = v_started
    WHERE id = v_job_id;

    RAISE LOG 'TELEMETRIA CLIENTES_ATIVIDADE START: Job=% para batch=%', v_job_id, v_batch_id;

    -- D. Executar a função de refresh de atividade comercial
    PERFORM public.refresh_clientes_atividade();

    v_finished := clock_timestamp();
    v_duration := round(EXTRACT(EPOCH FROM (v_finished - v_started))::numeric, 3);

    -- E. Registrar SUCESSO e estatísticas
    UPDATE public.cm_clientes_atividade_jobs
    SET status = 'SUCCESS',
        finished_at = v_finished,
        duration_seconds = v_duration,
        error_message = NULL
    WHERE id = v_job_id;

    RAISE LOG 'TELEMETRIA CLIENTES_ATIVIDADE SUCCESS: Job=% concluido em %ss', v_job_id, v_duration;

    -- Libera Lock
    PERFORM pg_advisory_unlock(v_lock_key);
    RETURN true;

  EXCEPTION WHEN OTHERS THEN
    v_finished := clock_timestamp();
    v_duration := round(EXTRACT(EPOCH FROM (v_finished - v_started))::numeric, 3);

    -- F. Registrar ERRO sem estourar exceção para a importação
    IF v_job_id IS NOT NULL THEN
      UPDATE public.cm_clientes_atividade_jobs
      SET status = 'ERROR',
          finished_at = v_finished,
          duration_seconds = v_duration,
          error_message = SQLERRM
      WHERE id = v_job_id;
    END IF;

    RAISE LOG 'TELEMETRIA CLIENTES_ATIVIDADE ERROR: Job=% falhou em %ss com mensagem: %', v_job_id, v_duration, SQLERRM;

    -- Garantir liberação do lock no bloco de erro
    PERFORM pg_advisory_unlock(v_lock_key);
    RETURN false;
  END;
END;
$function$;

-- 4. Função Helper para Enfileirar Refresh de Atividade em Background
CREATE OR REPLACE FUNCTION public.fn_enqueue_clientes_atividade_refresh(
  p_batch_id uuid DEFAULT NULL,
  p_trigger_source text DEFAULT 'IMPORT_JOB'
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO public.cm_clientes_atividade_jobs (batch_id, status, trigger_source)
  VALUES (p_batch_id, 'PENDING', COALESCE(p_trigger_source, 'IMPORT_JOB'))
  RETURNING id INTO v_job_id;

  -- Disparar worker assíncrono imediato
  PERFORM public.fn_process_clientes_atividade_queue();

  RETURN v_job_id;
END;
$function$;

-- 5. RPC de Reexecução Manual Explicita
CREATE OR REPLACE FUNCTION public.fn_trigger_refresh_clientes_atividade_manual()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_job_id uuid;
  v_job_record record;
BEGIN
  -- Enfileira com marcação MANUAL
  v_job_id := public.fn_enqueue_clientes_atividade_refresh(NULL, 'MANUAL');

  -- Busca o resultado do processamento
  SELECT id, status, started_at, finished_at, duration_seconds, error_message
  INTO v_job_record
  FROM public.cm_clientes_atividade_jobs
  WHERE id = v_job_id;

  RETURN jsonb_build_object(
    'success', (v_job_record.status = 'SUCCESS'),
    'job_id', v_job_record.id,
    'status', v_job_record.status,
    'duration_seconds', v_job_record.duration_seconds,
    'error_message', v_job_record.error_message
  );
END;
$function$;
