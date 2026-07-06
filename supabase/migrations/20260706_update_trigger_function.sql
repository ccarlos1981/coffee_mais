-- Update trigger function to target base table cm_faturamento directly instead of view
CREATE OR REPLACE FUNCTION tg_fn_sync_faturamento_sankhya_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_partners VARCHAR[];
BEGIN
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
          SUM(vlr_total_liq) as total_mes
        FROM public.cm_faturamento
        WHERE cod_parceiro = b.cod_parceiro
          AND dt_faturamento < date_trunc('month', CURRENT_DATE)
        GROUP BY date_trunc('month', dt_faturamento)
      )
      SELECT COALESCE(AVG(total_mes), 0.00) FROM monthly_sums
    )
    WHERE b.cod_parceiro = ANY(affected_partners);
  END IF;

  RETURN NULL;
END;
$$;
