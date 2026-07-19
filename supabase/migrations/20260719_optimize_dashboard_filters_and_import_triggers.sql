-- Migration: 20260719_optimize_dashboard_filters_and_import_triggers.sql
-- Description: Otimiza get_dashboard_filters_rpc (reduz de 11s para ~190ms) e substitui ALTER TABLE DISABLE TRIGGER por variáveis de sessão locais, evitando timeouts de importação e bloqueios físicos concorrentes.

-- 1. Otimizar a RPC de Filtros do Dashboard
CREATE OR REPLACE FUNCTION public.get_dashboard_filters_rpc()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN json_build_object(
    'managers', (
      SELECT json_agg(t.val) FROM (
        SELECT DISTINCT responsavel as val FROM public.cm_clientes WHERE responsavel IS NOT NULL AND responsavel <> ''
        UNION
        SELECT unnest(ARRAY['Amazon 1P', 'Ecommerce', 'Marketplace', 'Distribuidor']) as val
        ORDER BY 1
      ) t
    ),
    'ufs', (
      SELECT json_agg(t.val) FROM (
        SELECT DISTINCT uf as val FROM public.cm_clientes WHERE uf IS NOT NULL AND uf <> ''
        UNION
        SELECT unnest(ARRAY['SP']) as val
        ORDER BY 1
      ) t
    ),
    'channels', (
      SELECT json_agg(t.val) FROM (
        SELECT DISTINCT tipo_parceiro as val FROM public.cm_clientes WHERE tipo_parceiro IS NOT NULL AND tipo_parceiro <> ''
        UNION
        SELECT unnest(ARRAY['Amazon 1P', 'Ecommerce', 'Marketplace', 'Distribuidor']) as val
        ORDER BY 1
      ) t
    ),
    'produtos', (
      SELECT json_agg(t.val) FROM (
        SELECT DISTINCT product as val FROM public.mv_vendas_agg WHERE product IS NOT NULL ORDER BY product
      ) t
    ),
    'familias', (
      SELECT json_agg(t.val) FROM (
        SELECT unnest(ARRAY['1 KG', '5 KG', 'Acessório', 'Café Verde', 'Cápsula', 'Drip', 'Geisha', 'Grão', 'Moído', 'Outros']) as val
        ORDER BY 1
      ) t
    ),
    'matrizes', (
      SELECT json_agg(t.val) FROM (
        SELECT DISTINCT matriz as val FROM public.cm_clientes WHERE matriz IS NOT NULL AND matriz <> '' ORDER BY matriz
      ) t
    )
  );
END;
$function$;

-- 2. Atualizar a trigger de faturamento para suportar bypass via variável de sessão/transação
CREATE OR REPLACE FUNCTION public.tg_fn_sync_faturamento_sankhya_stmt()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  affected_partners VARCHAR[];
BEGIN
  -- Verificar se o bypass está ativado para esta transação/sessão (evita locks e timeouts de importação)
  IF current_setting('coffee_mais.bypass_faturamento_trigger', true) = 'true' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT array_agg(DISTINCT cod_parceiro) INTO affected_partners
    FROM old_table
    WHERE cod_parceiro IS NOT NULL;
  ELSIF TG_OP = 'INSERT' THEN
    SELECT array_agg(DISTINCT cod_parceiro) INTO affected_partners
    FROM new_table
    WHERE cod_parceiro IS NOT NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT array_agg(DISTINCT cod_parceiro) INTO affected_partners
    FROM (
      SELECT cod_parceiro FROM old_table WHERE cod_parceiro IS NOT NULL
      UNION
      SELECT cod_parceiro FROM new_table WHERE cod_parceiro IS NOT NULL
    ) t;
  END IF;

  IF affected_partners IS NOT NULL AND array_length(affected_partners, 1) > 0 THEN
    -- Update faturamento_mensal for all affected partners in bulk
    UPDATE public.base_atendimento b
    SET faturamento_mensal = (
      WITH monthly_sums AS (
        SELECT
          SUM(
            CASE 
              WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(CAST(f.vlr_total_liq AS numeric), 0))
              ELSE COALESCE(CAST(f.vlr_total_liq AS numeric), 0)
            END
          ) as total_mes
        FROM public.cm_faturamento f
        LEFT JOIN public.base_atendimento b2 ON b2.cod_parceiro = f.cod_parceiro
        WHERE f.cod_parceiro = b.cod_parceiro
          AND f.dt_faturamento < date_trunc('month', CURRENT_DATE)
          AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
          AND f.nome_parceiro != 'CAFE UTAM S/A'
          AND f.nome_parceiro != 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'
          AND (
            -- Canais Digitais (Ecommerce e Marketplace)
            (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') 
             AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
            OR
            -- Canais B2B e outros
            (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI')
             AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703)
             AND (b2.manager IS NULL OR b2.manager NOT IN ('Ecommerce', 'Marketplace')))
          )
        GROUP BY date_trunc('month', f.dt_faturamento)
      )
      SELECT COALESCE(AVG(total_mes), 0.00) FROM monthly_sums
    )
    WHERE b.cod_parceiro = ANY(affected_partners);
  END IF;

  RETURN NULL;
END;
$function$;

-- 3. Atualizar a RPC de preparar importação para habilitar o bypass
CREATE OR REPLACE FUNCTION public.preparar_importacao_faturamento(p_batch_id text, p_mode text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_period_start date;
  v_period_end date;
BEGIN
  -- Ativar o bypass de triggers de faturamento para esta transação
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- Obter informações de período do lote
  SELECT period_start, period_end 
  INTO v_period_start, v_period_end
  FROM public.cm_sync_logs
  WHERE id = p_batch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação % não encontrado.', p_batch_id;
  END IF;

  -- Capturar parceiros afetados antes de qualquer modificação física
  INSERT INTO public.cm_import_affected_partners (batch_id, cod_parceiro)
  SELECT DISTINCT p_batch_id, cod_parceiro
  FROM (
    SELECT cod_parceiro 
    FROM public.cm_faturamento 
    WHERE p_mode = 'replace' 
      AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL
      AND dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date
      AND cod_parceiro IS NOT NULL
    UNION
    SELECT cod_parceiro 
    FROM public.cm_faturamento_staging 
    WHERE batch_id = p_batch_id
      AND cod_parceiro IS NOT NULL
  ) t
  WHERE cod_parceiro IN (SELECT cod_parceiro FROM public.base_atendimento)
  ON CONFLICT (batch_id, cod_parceiro) DO NOTHING;

  -- Se for modo 'replace', apagar registros da tabela oficial
  IF p_mode = 'replace' AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL THEN
    DELETE FROM public.cm_faturamento 
    WHERE dt_faturamento >= date_trunc('month', v_period_start)::date 
      AND dt_faturamento <= (date_trunc('month', v_period_end) + interval '1 month' - interval '1 day')::date;
  END IF;

END;
$function$;

-- 4. Atualizar a RPC de promover lote para remover ALTER TABLE e habilitar o bypass
CREATE OR REPLACE FUNCTION public.promover_lote_faturamento(p_batch_id text, p_offset integer, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_rows_inserted integer := 0;
BEGIN
  -- Ativar o bypass de triggers de faturamento para esta transação (substitui ALTER TABLE e remove AccessExclusiveLock)
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  INSERT INTO public.cm_faturamento (
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
  FROM (
    SELECT *
    FROM public.cm_faturamento_staging
    WHERE batch_id = p_batch_id
    ORDER BY id
    LIMIT p_limit
    OFFSET p_offset
  ) sub;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  RETURN v_rows_inserted;
END;
$function$;

-- 5. Atualizar a RPC de finalizar importação para habilitar o bypass
CREATE OR REPLACE FUNCTION public.finalizar_importacao_faturamento(p_batch_id text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ativar o bypass de triggers de faturamento para esta transação
  PERFORM set_config('coffee_mais.bypass_faturamento_trigger', 'true', true);

  -- Atualizar a base_atendimento em lote para todos os parceiros afetados gravados na tabela de controle
  UPDATE public.base_atendimento b
  SET faturamento_mensal = COALESCE(s.avg_total_mes, 0.00)
  FROM (
    WITH partner_monthly_sums AS (
      SELECT
        cod_parceiro,
        SUM(
          CASE 
            WHEN cod_top IN ('1200', '1201') THEN -ABS(vlr_total_liq)
            ELSE vlr_total_liq
          END
        ) as total_mes
      FROM public.cm_faturamento
      WHERE cod_parceiro IN (SELECT cod_parceiro FROM public.cm_import_affected_partners WHERE batch_id = p_batch_id)
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

  -- Deletar registros correspondentes da staging
  DELETE FROM public.cm_faturamento_staging
  WHERE batch_id = p_batch_id;

  -- Limpar parceiros afetados
  DELETE FROM public.cm_import_affected_partners
  WHERE batch_id = p_batch_id;

END;
$function$;
