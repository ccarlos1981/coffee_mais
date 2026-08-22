-- Migration: 20260821_atomic_swap_and_advisory_lock.sql
-- Description: Implementa o Atomic Stage-and-Swap, PostgreSQL Advisory Lock e Missing Invoice Guard para o motor de importação automática

-- 0. Expandir constraints de cm_sync_logs para suportar google_drive e cron_07
ALTER TABLE public.cm_sync_logs DROP CONSTRAINT IF EXISTS cm_sync_logs_source_check;
ALTER TABLE public.cm_sync_logs ADD CONSTRAINT cm_sync_logs_source_check CHECK (source = ANY (ARRAY['bigquery'::text, 'excel'::text, 'google_drive'::text, 'google_drive_csv'::text]));

ALTER TABLE public.cm_sync_logs DROP CONSTRAINT IF EXISTS cm_sync_logs_triggered_by_check;
ALTER TABLE public.cm_sync_logs ADD CONSTRAINT cm_sync_logs_triggered_by_check CHECK (triggered_by = ANY (ARRAY['manual'::text, 'cron_06'::text, 'cron_07'::text, 'cron_12'::text, 'cron_18'::text, 'reconciliation'::text, 'dry_run_test_suite'::text]));

-- 1. Função para aquisição do Advisory Lock exclusivo da esteira de importação
CREATE OR REPLACE FUNCTION public.fn_acquire_import_lock()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked boolean;
BEGIN
  SELECT pg_try_advisory_lock(hashtext('coffee_mais_import_drive_lock')) INTO v_locked;
  RETURN v_locked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_acquire_import_lock() TO anon, authenticated, service_role;

-- 2. Função para liberação do Advisory Lock
CREATE OR REPLACE FUNCTION public.fn_release_import_lock()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unlocked boolean;
BEGIN
  SELECT pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock')) INTO v_unlocked;
  RETURN v_unlocked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_release_import_lock() TO anon, authenticated, service_role;

-- 3. Função para comparação de NFs (Missing Invoice Guard)
CREATE OR REPLACE FUNCTION public.fn_check_missing_invoices(
  p_batch_id text,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_missing_count integer := 0;
  v_missing_val numeric := 0;
  v_sample jsonb := '[]'::jsonb;
BEGIN
  WITH prev_active_nfs AS (
    SELECT DISTINCT nro_nota, cod_parceiro, cod_produto, vlr_total_liq
    FROM public.cm_faturamento
    WHERE dt_faturamento >= date_trunc('month', p_period_start)::date
      AND dt_faturamento <= (date_trunc('month', p_period_end) + interval '1 month' - interval '1 day')::date
      AND (status_nfe IS NULL OR upper(status_nfe) NOT IN ('CANCELADA', 'CANCELADO'))
  ),
  new_staging_nfs AS (
    SELECT DISTINCT nro_nota, cod_parceiro, cod_produto
    FROM public.cm_faturamento_staging
    WHERE batch_id::text = p_batch_id
  ),
  missing_diff AS (
    SELECT p.nro_nota, p.cod_parceiro, p.vlr_total_liq
    FROM prev_active_nfs p
    LEFT JOIN new_staging_nfs n 
      ON p.nro_nota = n.nro_nota 
     AND p.cod_parceiro = n.cod_parceiro 
     AND p.cod_produto = n.cod_produto
    WHERE n.nro_nota IS NULL
  )
  SELECT 
    COUNT(*), 
    COALESCE(SUM(vlr_total_liq), 0),
    COALESCE(jsonb_agg(jsonb_build_object('nro_nota', nro_nota, 'cod_parceiro', cod_parceiro, 'vlr', vlr_total_liq)) FILTER (WHERE nro_nota IS NOT NULL), '[]'::jsonb)
  INTO v_missing_count, v_missing_val, v_sample
  FROM (
    SELECT nro_nota, cod_parceiro, vlr_total_liq FROM missing_diff LIMIT 10
  ) s;

  RETURN jsonb_build_object(
    'missing_count', COALESCE(v_missing_count, 0),
    'missing_value', COALESCE(v_missing_val, 0),
    'sample_invoices', v_sample
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_check_missing_invoices(text, date, date) TO anon, authenticated, service_role;

-- 4. Função Transacional de Atomic Stage-and-Swap com suporte a DRY_RUN
CREATE OR REPLACE FUNCTION public.executar_atomic_swap_faturamento(
  p_batch_id text,
  p_dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  v_locked boolean;
  v_staging_count bigint;
  v_staging_net numeric;
  v_period_start date;
  v_period_end date;
  v_inserted_count bigint := 0;
  v_deleted_count bigint := 0;
BEGIN
  -- 1. Tentar adquirir o Advisory Lock
  SELECT pg_try_advisory_lock(hashtext('coffee_mais_import_drive_lock')) INTO v_locked;
  IF NOT v_locked THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONCURRENT_JOB_RUNNING',
      'message', 'Outro processo de importação está ativo no momento. Lock exclusivo retido.'
    );
  END IF;

  -- 2. Obter totais da staging
  SELECT 
    COUNT(*), 
    COALESCE(SUM(vlr_total_liq), 0),
    MIN(dt_faturamento),
    MAX(dt_faturamento)
  INTO v_staging_count, v_staging_net, v_period_start, v_period_end
  FROM public.cm_faturamento_staging
  WHERE batch_id::text = p_batch_id;

  IF v_staging_count = 0 OR v_period_start IS NULL THEN
    PERFORM pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock'));
    RETURN jsonb_build_object(
      'success', false,
      'error', 'EMPTY_STAGING',
      'message', 'Nenhum registro encontrado na staging para o lote fornecido.'
    );
  END IF;

  -- 3. Se for DRY_RUN: simula sem tocar em cm_faturamento
  IF p_dry_run THEN
    PERFORM pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock'));
    RETURN jsonb_build_object(
      'success', true,
      'mode', 'DRY_RUN_SIMULATION',
      'batch_id', p_batch_id,
      'staging_rows', v_staging_count,
      'staging_net', v_staging_net,
      'period_start', v_period_start,
      'period_end', v_period_end,
      'message', 'Simulação de Atomic Swap aprovada. Nenhuma mutação executada na base oficial.'
    );
  END IF;

  -- 4. Execução Real Atômica (Transacional)
  -- Ativar bypass de triggers de faturamento para evitar locks em cascata
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- a. Remover fotografia anterior do mês correspondente
  DELETE FROM public.cm_faturamento
  WHERE dt_faturamento >= date_trunc('month', v_period_start)::date
    AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- b. Inserir nova fotografia integral diretamente da staging
  INSERT INTO public.cm_faturamento (
    origem, batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
    cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
    vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
    custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
    cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
    vlr_total_st, cod_cr, centro_resultado, valor_venda_futura
  )
  SELECT 
    'GOOGLE_DRIVE_CSV', p_batch_id::uuid, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
    cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
    vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
    custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
    cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
    vlr_total_st, cod_cr, centro_resultado, COALESCE(valor_venda_futura, 0)
  FROM public.cm_faturamento_staging
  WHERE batch_id::text = p_batch_id;
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- c. Validação interna de integridade pré-commit
  IF v_inserted_count <> v_staging_count THEN
    PERFORM pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock'));
    RAISE EXCEPTION 'FALHA NO SWAP ATOMICO: Linhas inseridas (%) divergentes da staging (%). Transação desfeita.', v_inserted_count, v_staging_count;
  END IF;

  -- d. Limpar staging
  DELETE FROM public.cm_faturamento_staging WHERE batch_id::text = p_batch_id;

  -- e. Enfileirar refresh de Materialized Views
  PERFORM public.fn_enqueue_mv_refresh(p_batch_id::uuid);

  -- f. Liberar lock
  PERFORM pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock'));

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'REAL_SWAP_COMMITTED',
    'batch_id', p_batch_id,
    'rows_deleted_previous', v_deleted_count,
    'rows_inserted_new', v_inserted_count,
    'net_swapped', v_staging_net,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'message', 'Swap Atômico concluído com sucesso e views enfileiradas.'
  );
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(hashtext('coffee_mais_import_drive_lock'));
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.executar_atomic_swap_faturamento(text, boolean) TO anon, authenticated, service_role;
