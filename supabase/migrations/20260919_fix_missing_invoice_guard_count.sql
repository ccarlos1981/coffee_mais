-- Migration: 20260919_fix_missing_invoice_guard_count.sql
-- Descrição: Corrige defeito de contagem na RPC fn_check_missing_invoices.
-- A contagem de NFs ausentes agora representa NOTAS FISCAIS DISTINTAS (identificadas por (nro_nota, cod_parceiro)),
-- preservando a contagem de itens/SKUs e o detalhamento forense por nota e por item.

CREATE OR REPLACE FUNCTION public.fn_check_missing_invoices(p_batch_id text, p_period_start date, p_period_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_missing_invoices_count integer := 0;
  v_missing_items_count integer := 0;
  v_missing_val numeric := 0;
  v_sample_invoices jsonb := '[]'::jsonb;
  v_sample_items jsonb := '[]'::jsonb;
BEGIN
  WITH prev_active_nfs AS (
    SELECT 
      nro_nota, 
      cod_parceiro, 
      cod_produto, 
      SUM(COALESCE(vlr_total_liq, 0)) AS vlr_total_liq
    FROM public.cm_faturamento
    WHERE dt_faturamento >= date_trunc('month', p_period_start)::date
      AND dt_faturamento <= (date_trunc('month', p_period_end) + interval '1 month' - interval '1 day')::date
      AND (status_nfe IS NULL OR upper(status_nfe) NOT IN ('CANCELADA', 'CANCELADO'))
    GROUP BY nro_nota, cod_parceiro, cod_produto
  ),
  new_staging_nfs AS (
    SELECT DISTINCT 
      nro_nota, 
      cod_parceiro, 
      cod_produto
    FROM public.cm_faturamento_staging
    WHERE batch_id::text = p_batch_id
  ),
  missing_diff AS (
    SELECT 
      p.nro_nota, 
      p.cod_parceiro, 
      p.cod_produto, 
      p.vlr_total_liq
    FROM prev_active_nfs p
    LEFT JOIN new_staging_nfs n 
      ON p.nro_nota = n.nro_nota 
     AND p.cod_parceiro = n.cod_parceiro 
     AND p.cod_produto = n.cod_produto
    WHERE n.nro_nota IS NULL
  ),
  global_metrics AS (
    SELECT 
      COUNT(DISTINCT (COALESCE(nro_nota, ''), COALESCE(cod_parceiro, '')))::integer AS total_invoices_count,
      COUNT(*)::integer AS total_items_count,
      COALESCE(SUM(vlr_total_liq), 0)::numeric AS total_value
    FROM missing_diff
  ),
  sample_invoices_grouped AS (
    SELECT 
      nro_nota, 
      cod_parceiro, 
      COUNT(*)::integer AS item_count,
      SUM(vlr_total_liq) AS vlr_total
    FROM missing_diff
    GROUP BY nro_nota, cod_parceiro
    ORDER BY SUM(vlr_total_liq) DESC, nro_nota ASC
    LIMIT 10
  ),
  sample_items_rows AS (
    SELECT 
      nro_nota, 
      cod_parceiro, 
      cod_produto, 
      vlr_total_liq
    FROM missing_diff
    ORDER BY 
      vlr_total_liq DESC, 
      nro_nota ASC, 
      cod_parceiro ASC, 
      cod_produto ASC
    LIMIT 10
  )
  SELECT 
    gm.total_invoices_count,
    gm.total_items_count,
    gm.total_value,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nro_nota', s.nro_nota,
            'cod_parceiro', s.cod_parceiro,
            'item_count', s.item_count,
            'vlr', s.vlr_total
          )
        )
        FROM sample_invoices_grouped s
      ),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'nro_nota', si.nro_nota,
            'cod_parceiro', si.cod_parceiro,
            'cod_produto', si.cod_produto,
            'vlr', si.vlr_total_liq
          )
        )
        FROM sample_items_rows si
      ),
      '[]'::jsonb
    )
  INTO v_missing_invoices_count, v_missing_items_count, v_missing_val, v_sample_invoices, v_sample_items
  FROM global_metrics gm;

  RETURN jsonb_build_object(
    'missing_count', COALESCE(v_missing_invoices_count, 0),
    'missing_invoice_count', COALESCE(v_missing_invoices_count, 0),
    'missing_item_count', COALESCE(v_missing_items_count, 0),
    'missing_value', COALESCE(v_missing_val, 0),
    'sample_invoices', v_sample_invoices,
    'sample_items', v_sample_items
  );
END;
$function$;
