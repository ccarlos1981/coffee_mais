-- Migration: Batch Import Engine v1 Database Functions
-- Date: 19/07/2026

-- 1. Create table to store affected partners across connections/transactions
CREATE TABLE IF NOT EXISTS public.cm_import_affected_partners (
  batch_id UUID NOT NULL REFERENCES public.cm_sync_logs(id) ON DELETE CASCADE,
  cod_parceiro TEXT NOT NULL,
  PRIMARY KEY (batch_id, cod_parceiro)
);

-- Grant permissions for the table
ALTER TABLE public.cm_import_affected_partners OWNER TO postgres;
GRANT ALL ON TABLE public.cm_import_affected_partners TO anon, authenticated, service_role;

-- 2. Function to prepare import (capture affected partners and perform delete replace if needed)
CREATE OR REPLACE FUNCTION public.preparar_importacao_faturamento(p_batch_id uuid, p_mode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_start date;
  v_period_end date;
BEGIN
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
$$;

-- Grant permissions for prepare function
GRANT EXECUTE ON FUNCTION public.preparar_importacao_faturamento(uuid, text) TO anon, authenticated, service_role;

-- 3. Function to promote a single chunk of rows
CREATE OR REPLACE FUNCTION public.promover_lote_faturamento(p_batch_id uuid, p_offset integer, p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_inserted integer := 0;
BEGIN
  -- Desativar temporariamente triggers USER para evitar gargalo de recálculo individual
  ALTER TABLE public.cm_faturamento DISABLE TRIGGER USER;

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

  -- Reativar triggers
  ALTER TABLE public.cm_faturamento ENABLE TRIGGER USER;

  RETURN v_rows_inserted;
EXCEPTION WHEN OTHERS THEN
  -- Garantir que triggers sejam reativados em caso de erro
  ALTER TABLE public.cm_faturamento ENABLE TRIGGER USER;
  RAISE;
END;
$$;

-- Grant permissions for batch function
GRANT EXECUTE ON FUNCTION public.promover_lote_faturamento(uuid, integer, integer) TO anon, authenticated, service_role;

-- 4. Function to finalize import (recalculate averages and clean up staging)
CREATE OR REPLACE FUNCTION public.finalizar_importacao_faturamento(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
$$;

-- Grant permissions for finalize function
GRANT EXECUTE ON FUNCTION public.finalizar_importacao_faturamento(uuid) TO anon, authenticated, service_role;
