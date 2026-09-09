-- Migration: 20260909_rpc_controlled_month_end_increment.sql
-- Description: Implementação da RPC governada executar_incremento_fechamento_mensal e
--              da RPC de rollback executar_rollback_incremento_mensal para suportar
--              o fechamento incremental de fim de mês com isolamento transacional,
--              recomposição de base_atendimento e preservação histórica de 01-30 e meses futuros.

-- 1. RPC de Execução do Incremento Controlado
CREATE OR REPLACE FUNCTION public.executar_incremento_fechamento_mensal(
  p_batch_id uuid,
  p_target_date date,
  p_expected_rows integer,
  p_expected_net numeric,
  p_justification text DEFAULT 'Fechamento incremental de fim de mês',
  p_source_file text DEFAULT NULL,
  p_source_sha256 text DEFAULT NULL,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb AS $$
DECLARE
  v_auth_uid uuid;
  v_user_role text := 'SERVICE_ROLE';
  v_user_approved boolean := true;
  v_locked boolean;
  v_already_closed integer;
  v_staging_count bigint;
  v_staging_net numeric;
  v_min_staging date;
  v_max_staging date;
  v_cancelled_count bigint;
  v_invalid_top bigint;
  v_colliding_nfs bigint;
  v_colliding_target_nfs bigint;
  v_rows_before bigint;
  v_net_before numeric;
  v_rows_future_before bigint;
  v_net_future_before numeric;
  v_inserted_count bigint := 0;
  v_rows_after bigint;
  v_net_after numeric;
  v_rows_future_after bigint;
  v_net_future_after numeric;
  v_t_insert_start timestamptz;
  v_t_insert_end timestamptz;
  v_insert_ms numeric := 0.0;
  v_t_recomp_start timestamptz;
  v_t_recomp_end timestamptz;
  v_recomp_ms numeric := 0.0;
  v_t_total_start timestamptz := clock_timestamp();
  v_total_ms numeric := 0.0;
  v_ka_net numeric := 0.0;
  v_ka_bonif numeric := 0.0;
  v_dist_net numeric := 0.0;
  v_dist_bonif numeric := 0.0;
  v_month_start date := date_trunc('month', p_target_date)::date;
  v_month_end date := (date_trunc('month', p_target_date) + interval '1 month' - interval '1 day')::date;
BEGIN
  -- 1. Configurar search_path estrito
  PERFORM set_config('search_path', 'public, pg_temp', true);

  -- 2. Validar autenticação e autorização via perfil se invocado por usuário autenticado
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NOT NULL THEN
    SELECT role, approved INTO v_user_role, v_user_approved
    FROM public.cm_user_profiles
    WHERE id = v_auth_uid;

    IF NOT FOUND OR v_user_approved IS NOT TRUE OR v_user_role NOT IN ('Admin', 'Admin Master') THEN
      RAISE EXCEPTION 'ACESSO NEGADO (HTTP 403): Operação restrita a usuários com perfil Admin ou Admin Master aprovados.';
    END IF;
  END IF;

  -- 3. Adquirir Advisory Lock Transacional exclusivo para a data alvo
  SELECT pg_try_advisory_xact_lock(hashtext('coffee_mais_increment_' || p_target_date::text)) INTO v_locked;
  IF NOT v_locked THEN
    RAISE EXCEPTION 'CONCORRÊNCIA BLOQUEADA: Outra transação de incremento está ativa para a data %.', p_target_date;
  END IF;

  -- 4. Target-Date Singleton e Proteção de Reexecução do Batch
  IF EXISTS (SELECT 1 FROM public.cm_faturamento WHERE batch_id = p_batch_id) THEN
    RAISE EXCEPTION 'BATCH_ALREADY_PROCESSED: O batch % já foi processado e inserido anteriormente em cm_faturamento.', p_batch_id;
  END IF;

  SELECT COUNT(*) INTO v_already_closed
  FROM public.cm_faturamento
  WHERE dt_faturamento = p_target_date AND origem = 'CONTROLLED_INCREMENT';

  IF v_already_closed > 0 THEN
    RAISE EXCEPTION 'TARGET_DATE_ALREADY_INCREMENTED: A data % já possui incremento homologado (linhas: %).', p_target_date, v_already_closed;
  END IF;

  -- 5. Idempotência por SHA-256 em cm_sync_logs
  IF p_source_sha256 IS NOT NULL AND TRIM(p_source_sha256) <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.cm_sync_logs
      WHERE status = 'SUCCESS'
        AND metadata->>'operation' = 'CONTROLLED_MONTH_END_INCREMENT'
        AND metadata->>'file_hash' = p_source_sha256
    ) THEN
      RAISE EXCEPTION 'DUPLICATE_SHA_PROCESSED: Arquivo com mesmo SHA-256 já foi processado anteriormente com sucesso.';
    END IF;
  END IF;

  -- 6. Validações da Staging (Isolamento por batch_id)
  SELECT 
    COUNT(*),
    COALESCE(SUM(vlr_total_liq), 0),
    MIN(dt_faturamento),
    MAX(dt_faturamento)
  INTO v_staging_count, v_staging_net, v_min_staging, v_max_staging
  FROM public.cm_faturamento_staging
  WHERE batch_id = p_batch_id;

  IF v_staging_count = 0 OR v_staging_count IS NULL THEN
    RAISE EXCEPTION 'EMPTY_STAGING: Nenhum registro encontrado na staging para o batch %.', p_batch_id;
  END IF;

  IF v_min_staging <> p_target_date OR v_max_staging <> p_target_date THEN
    RAISE EXCEPTION 'INVALID_STAGING_DATE: Staging contém registros fora da data alvo % (mínimo: %, máximo: %).', p_target_date, v_min_staging, v_max_staging;
  END IF;

  SELECT COUNT(*) INTO v_cancelled_count
  FROM public.cm_faturamento_staging
  WHERE batch_id = p_batch_id AND upper(status_nfe) IN ('CANCELADA', 'CANCELADO');

  IF v_cancelled_count > 0 THEN
    RAISE EXCEPTION 'CANCELLED_INVOICE_IN_STAGING: Foram encontradas % notas fiscais canceladas na staging.', v_cancelled_count;
  END IF;

  SELECT COUNT(*) INTO v_invalid_top
  FROM public.cm_faturamento_staging
  WHERE batch_id = p_batch_id 
    AND (cod_top IS NULL OR cod_top NOT IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723'));

  IF v_invalid_top > 0 THEN
    RAISE EXCEPTION 'INVALID_TOP_DETECTED: Foram encontrados % registros com TOP inválida/adulterada na staging.', v_invalid_top;
  END IF;

  IF p_expected_rows IS NOT NULL AND v_staging_count <> p_expected_rows THEN
    RAISE EXCEPTION 'DIVERGENT_ROWS_COUNT: Quantidade de linhas na staging (%) diverge do esperado (%).', v_staging_count, p_expected_rows;
  END IF;

  IF p_expected_net IS NOT NULL AND abs(v_staging_net - p_expected_net) > 0.05 THEN
    RAISE EXCEPTION 'DIVERGENT_NET_REVENUE: Faturamento na staging (R$ %) diverge do esperado (R$ %).', v_staging_net, p_expected_net;
  END IF;

  -- 7. Collision Guard: NFs da staging não podem existir na base histórica do mês
  SELECT COUNT(DISTINCT f.nro_nota) INTO v_colliding_nfs
  FROM public.cm_faturamento f
  JOIN public.cm_faturamento_staging s 
    ON f.nro_nota = s.nro_nota AND f.cod_parceiro = s.cod_parceiro
  WHERE s.batch_id = p_batch_id
    AND f.dt_faturamento >= v_month_start
    AND f.dt_faturamento < p_target_date;

  IF v_colliding_nfs > 0 THEN
    RAISE EXCEPTION 'COLLISION_DETECTED: Foram detectadas % NFs colidentes na base anterior a %.', v_colliding_nfs, p_target_date;
  END IF;

  -- Collision Guard sobre a própria data alvo
  SELECT COUNT(DISTINCT f.nro_nota) INTO v_colliding_target_nfs
  FROM public.cm_faturamento f
  JOIN public.cm_faturamento_staging s 
    ON f.nro_nota = s.nro_nota AND f.cod_parceiro = s.cod_parceiro
  WHERE s.batch_id = p_batch_id
    AND f.dt_faturamento = p_target_date;

  IF v_colliding_target_nfs > 0 THEN
    RAISE EXCEPTION 'COLLISION_DETECTED: Foram detectadas % NFs já existentes em cm_faturamento para a data %.', v_colliding_target_nfs, p_target_date;
  END IF;

  -- 8. Capturar Snapshots Prévios para Pós-Validação
  SELECT COUNT(*), COALESCE(SUM(vlr_total_liq), 0)
  INTO v_rows_before, v_net_before
  FROM public.cm_faturamento
  WHERE dt_faturamento >= v_month_start AND dt_faturamento < p_target_date;

  SELECT COUNT(*), COALESCE(SUM(vlr_total_liq), 0)
  INTO v_rows_future_before, v_net_future_before
  FROM public.cm_faturamento
  WHERE dt_faturamento > v_month_end;

  -- Calcular métricas isoladas de canais prioritários na staging (direto em staging por nome_vendedor)
  SELECT 
    COALESCE(SUM(CASE WHEN cod_top = '1100' THEN vlr_total_liq ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cod_top = '1117' THEN vlr_total_liq ELSE 0 END), 0)
  INTO v_ka_net, v_ka_bonif
  FROM public.cm_faturamento_staging s
  WHERE s.batch_id = p_batch_id AND UPPER(TRIM(COALESCE(s.nome_vendedor, ''))) = 'KEYACCOUNT';

  SELECT 
    COALESCE(SUM(CASE WHEN cod_top = '1100' THEN vlr_total_liq ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cod_top = '1117' THEN vlr_total_liq ELSE 0 END), 0)
  INTO v_dist_net, v_dist_bonif
  FROM public.cm_faturamento_staging s
  WHERE s.batch_id = p_batch_id AND UPPER(TRIM(COALESCE(s.nome_vendedor, ''))) = 'DISTRIBUIDOR';

  -- 9. Se for DRY-RUN: Simulação sem mutação física
  IF p_dry_run THEN
    v_total_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_t_total_start)) * 1000;
    RETURN jsonb_build_object(
      'success', true,
      'mode', 'DRY_RUN_SIMULATION',
      'batch_id', p_batch_id,
      'target_date', p_target_date,
      'staging_rows', v_staging_count,
      'staging_net', v_staging_net,
      'rows_before', v_rows_before,
      'net_before', v_net_before,
      'projected_rows', v_rows_before + v_staging_count,
      'projected_net', v_net_before + v_staging_net,
      'ka_net_increment', v_ka_net,
      'ka_bonif_increment', v_ka_bonif,
      'dist_net_increment', v_dist_net,
      'dist_bonif_increment', v_dist_bonif,
      'future_rows_intact', v_rows_future_before,
      'future_net_intact', v_net_future_before,
      'execution_time_ms', v_total_ms,
      'message', 'Simulação de incremento controlada concluída com sucesso. Zero mutações no banco.'
    );
  END IF;

  -- 10. Execução Real Atômica
  -- Ativar bypass de trigger local à transação corrente
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- Inserir dados do lote incremental
  v_t_insert_start := clock_timestamp();
  INSERT INTO public.cm_faturamento (
    origem, batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
    cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
    vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
    custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
    cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
    vlr_total_st, cod_cr, centro_resultado, valor_venda_futura
  )
  SELECT 
    'CONTROLLED_INCREMENT', p_batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
    cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
    vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
    custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
    cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
    vlr_total_st, cod_cr, centro_resultado, COALESCE(valor_venda_futura, 0)
  FROM public.cm_faturamento_staging
  WHERE batch_id = p_batch_id;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  v_t_insert_end := clock_timestamp();
  v_insert_ms := EXTRACT(EPOCH FROM (v_t_insert_end - v_t_insert_start)) * 1000;

  IF v_inserted_count <> v_staging_count THEN
    RAISE EXCEPTION 'INSERT_MISMATCH: Linhas inseridas (%) divergem da staging (%). Transação desfeita.', v_inserted_count, v_staging_count;
  END IF;

  -- 11. Recomposição Set-Based de base_atendimento
  v_t_recomp_start := clock_timestamp();
  UPDATE public.base_atendimento b
  SET faturamento_mensal = COALESCE(s.avg_total_mes, 0.00)
  FROM (
    WITH partner_monthly_sums AS (
      SELECT
        cod_parceiro,
        SUM(
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(f.vlr_total_liq, 0))
            ELSE COALESCE(f.vlr_total_liq, 0)
          END
        ) as total_mes
      FROM public.cm_faturamento f
      WHERE cod_parceiro IN (SELECT DISTINCT cod_parceiro FROM public.cm_faturamento_staging WHERE batch_id = p_batch_id)
        AND dt_faturamento < date_trunc('month', CURRENT_DATE)
        AND (status_nfe IS NULL OR upper(status_nfe) NOT IN ('CANCELADA', 'CANCELADO'))
        AND nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
      GROUP BY cod_parceiro, date_trunc('month', dt_faturamento)
    )
    SELECT cod_parceiro, AVG(total_mes) as avg_total_mes 
    FROM partner_monthly_sums
    GROUP BY cod_parceiro
  ) s
  WHERE b.cod_parceiro = s.cod_parceiro;

  v_t_recomp_end := clock_timestamp();
  v_recomp_ms := EXTRACT(EPOCH FROM (v_t_recomp_end - v_t_recomp_start)) * 1000;

  -- 12. Pós-Validação: Base Histórica Anterior (01 a target_date - 1)
  SELECT COUNT(*), COALESCE(SUM(vlr_total_liq), 0)
  INTO v_rows_after, v_net_after
  FROM public.cm_faturamento
  WHERE dt_faturamento >= v_month_start AND dt_faturamento < p_target_date;

  IF v_rows_after <> v_rows_before OR abs(v_net_after - v_net_before) > 0.01 THEN
    RAISE EXCEPTION 'HISTORIC_DATA_MUTATED: Base histórica anterior a % foi alterada (Antes: % lin, R$ % | Depois: % lin, R$ %).',
      p_target_date, v_rows_before, v_net_before, v_rows_after, v_net_after;
  END IF;

  -- 13. Pós-Validação: Períodos Futuros (Setembro em diante)
  SELECT COUNT(*), COALESCE(SUM(vlr_total_liq), 0)
  INTO v_rows_future_after, v_net_future_after
  FROM public.cm_faturamento
  WHERE dt_faturamento > v_month_end;

  IF v_rows_future_after <> v_rows_future_before OR abs(v_net_future_after - v_net_future_before) > 0.01 THEN
    RAISE EXCEPTION 'FUTURE_DATA_MUTATED: Base de períodos futuros foi alterada (Antes: % lin, R$ % | Depois: % lin, R$ %).',
      v_rows_future_before, v_net_future_before, v_rows_future_after, v_net_future_after;
  END IF;

  -- 14. Limpeza da Staging
  DELETE FROM public.cm_faturamento_staging WHERE batch_id = p_batch_id;

  -- 15. Enfileirar Refresh de Materialized Views
  PERFORM public.fn_enqueue_mv_refresh(p_batch_id);

  v_total_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_t_total_start)) * 1000;

  -- 16. Gravar Log de Auditoria em cm_sync_logs
  INSERT INTO public.cm_sync_logs (
    id, source, started_at, finished_at, status, period_start, period_end,
    rows_fetched, rows_inserted, rows_updated, triggered_by, metadata
  ) VALUES (
    p_batch_id,
    'excel',
    v_t_total_start,
    clock_timestamp(),
    'SUCCESS',
    p_target_date,
    p_target_date,
    v_staging_count,
    v_inserted_count,
    0,
    'manual',
    jsonb_build_object(
      'operation', 'CONTROLLED_MONTH_END_INCREMENT',
      'user_id', COALESCE(v_auth_uid::text, 'SERVICE_ROLE'),
      'target_date', p_target_date,
      'justification', p_justification,
      'source_file', p_source_file,
      'file_hash', p_source_sha256,
      'user_role', v_user_role,
      'rows_before', v_rows_before,
      'net_before', v_net_before,
      'rows_increment', v_inserted_count,
      'net_increment', v_staging_net,
      'rows_after', v_rows_before + v_inserted_count,
      'net_after', v_net_before + v_staging_net,
      'ka_net', v_ka_net,
      'ka_bonif', v_ka_bonif,
      'dist_net', v_dist_net,
      'dist_bonif', v_dist_bonif,
      'insert_ms', v_insert_ms,
      'recomp_ms', v_recomp_ms,
      'total_ms', v_total_ms,
      'september_changed', false,
      'historic_changed', false
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'SUCCESS',
    finished_at = clock_timestamp(),
    rows_inserted = EXCLUDED.rows_inserted,
    metadata = EXCLUDED.metadata;

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'REAL_INCREMENT_COMMITTED',
    'batch_id', p_batch_id,
    'target_date', p_target_date,
    'rows_inserted', v_inserted_count,
    'net_inserted', v_staging_net,
    'rows_before', v_rows_before,
    'net_before', v_net_before,
    'total_rows_after', v_rows_before + v_inserted_count,
    'total_net_after', v_net_before + v_staging_net,
    'ka_net', v_ka_net,
    'ka_bonif', v_ka_bonif,
    'dist_net', v_dist_net,
    'dist_bonif', v_dist_bonif,
    'insert_execution_ms', v_insert_ms,
    'recomposition_execution_ms', v_recomp_ms,
    'total_execution_ms', v_total_ms,
    'message', 'Incremento controlado executado com sucesso e views enfileiradas.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC Cirúrgica de Rollback do Incremento
CREATE OR REPLACE FUNCTION public.executar_rollback_incremento_mensal(
  p_batch_id uuid,
  p_target_date date,
  p_justification text DEFAULT 'Rollback cirúrgico de incremento controlado'
) RETURNS jsonb AS $$
DECLARE
  v_auth_uid uuid;
  v_user_role text := 'SERVICE_ROLE';
  v_user_approved boolean := true;
  v_locked boolean;
  v_deleted_count bigint := 0;
  v_deleted_net numeric := 0.0;
  v_t_start timestamptz := clock_timestamp();
  v_duration_ms numeric := 0.0;
BEGIN
  PERFORM set_config('search_path', 'public, pg_temp', true);

  v_auth_uid := auth.uid();
  IF v_auth_uid IS NOT NULL THEN
    SELECT role, approved INTO v_user_role, v_user_approved
    FROM public.cm_user_profiles
    WHERE id = v_auth_uid;

    IF NOT FOUND OR v_user_approved IS NOT TRUE OR v_user_role NOT IN ('Admin', 'Admin Master') THEN
      RAISE EXCEPTION 'ACESSO NEGADO (HTTP 403): Operação restrita a Admin ou Admin Master.';
    END IF;
  END IF;

  SELECT pg_try_advisory_xact_lock(hashtext('coffee_mais_increment_' || p_target_date::text)) INTO v_locked;
  IF NOT v_locked THEN
    RAISE EXCEPTION 'CONCORRÊNCIA BLOQUEADA: Outra transação está ativa para a data %.', p_target_date;
  END IF;

  SELECT COALESCE(SUM(vlr_total_liq), 0) INTO v_deleted_net
  FROM public.cm_faturamento
  WHERE batch_id = p_batch_id
    AND dt_faturamento = p_target_date
    AND origem = 'CONTROLLED_INCREMENT';

  DELETE FROM public.cm_faturamento
  WHERE batch_id = p_batch_id
    AND dt_faturamento = p_target_date
    AND origem = 'CONTROLLED_INCREMENT';

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK_TARGET_NOT_FOUND: Nenhum registro de incremento encontrado para batch % e data %.', p_batch_id, p_target_date;
  END IF;

  PERFORM public.fn_enqueue_mv_refresh(p_batch_id);

  v_duration_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_t_start)) * 1000;

  INSERT INTO public.cm_sync_logs (
    id, source, started_at, finished_at, status, period_start, period_end,
    rows_fetched, rows_inserted, rows_updated, triggered_by, metadata
  ) VALUES (
    gen_random_uuid(),
    'excel',
    v_t_start,
    clock_timestamp(),
    'SUCCESS',
    p_target_date,
    p_target_date,
    0,
    0,
    v_deleted_count,
    'manual',
    jsonb_build_object(
      'operation', 'ROLLBACK_CONTROLLED_MONTH_END_INCREMENT',
      'action', 'ROLLED_BACK',
      'user_id', COALESCE(v_auth_uid::text, 'SERVICE_ROLE'),
      'target_batch_id', p_batch_id,
      'target_date', p_target_date,
      'rows_deleted', v_deleted_count,
      'net_deleted', v_deleted_net,
      'justification', p_justification,
      'duration_ms', v_duration_ms
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'mode', 'ROLLBACK_COMMITTED',
    'batch_id', p_batch_id,
    'target_date', p_target_date,
    'rows_deleted', v_deleted_count,
    'net_deleted', v_deleted_net,
    'duration_ms', v_duration_ms,
    'message', 'Rollback cirúrgico executado com sucesso e views enfileiradas.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Permissões
REVOKE EXECUTE ON FUNCTION public.executar_incremento_fechamento_mensal FROM anon;
REVOKE EXECUTE ON FUNCTION public.executar_rollback_incremento_mensal FROM anon;
GRANT EXECUTE ON FUNCTION public.executar_incremento_fechamento_mensal TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.executar_rollback_incremento_mensal TO authenticated, service_role;
