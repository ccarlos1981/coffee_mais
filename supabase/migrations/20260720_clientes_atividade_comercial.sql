-- 1. Criar a tabela física de cache da atividade comercial
CREATE TABLE IF NOT EXISTS public.cm_clientes_atividade (
  cliente_id UUID PRIMARY KEY REFERENCES public.cm_clientes(id) ON DELETE CASCADE,
  ultima_compra DATE,
  primeira_compra DATE,
  dias_sem_comprar INT,
  situacao_comercial TEXT,
  valor_faturado_12m NUMERIC DEFAULT 0,
  quantidade_notas_12m INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refresh_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar RLS e Permissões
ALTER TABLE public.cm_clientes_atividade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cm_clientes_atividade_policy ON public.cm_clientes_atividade;
DROP POLICY IF EXISTS cm_clientes_atividade_select_policy ON public.cm_clientes_atividade;
CREATE POLICY cm_clientes_atividade_select_policy ON public.cm_clientes_atividade
FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS cm_clientes_atividade_write_policy ON public.cm_clientes_atividade;
CREATE POLICY cm_clientes_atividade_write_policy ON public.cm_clientes_atividade
FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cm_clientes_atividade_update_policy ON public.cm_clientes_atividade;
CREATE POLICY cm_clientes_atividade_update_policy ON public.cm_clientes_atividade
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS cm_clientes_atividade_delete_policy ON public.cm_clientes_atividade;
CREATE POLICY cm_clientes_atividade_delete_policy ON public.cm_clientes_atividade
FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cm_clientes_atividade TO anon, authenticated, service_role;

-- 3. Criar índices para otimização das junções na tabela de cache
CREATE INDEX IF NOT EXISTS idx_cm_clientes_atividade_situacao ON public.cm_clientes_atividade(situacao_comercial);

-- 4. Criar a RPC específica para atualização da atividade comercial
CREATE OR REPLACE FUNCTION public.refresh_clientes_atividade()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage text;
  v_stage_start timestamptz;
  v_stage_end timestamptz;
  v_duration interval;
  v_refresh_time timestamptz := clock_timestamp();
BEGIN
  v_stage := 'refresh cm_clientes_atividade';
  v_stage_start := clock_timestamp();
  
  -- Limpa a tabela para recálculo total (Truncate)
  TRUNCATE TABLE public.cm_clientes_atividade;
  
  INSERT INTO public.cm_clientes_atividade (
    cliente_id,
    ultima_compra,
    primeira_compra,
    dias_sem_comprar,
    situacao_comercial,
    valor_faturado_12m,
    quantidade_notas_12m,
    updated_at,
    last_refresh_at
  )
  WITH faturamento_agregado AS (
    SELECT 
      cod_parceiro,
      nome_parceiro,
      translate(upper(nome_parceiro), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝŸ', 'AAAAAEEEEIIIIOOOOOUUUUCNYY') as norm_nome,
      MIN(dt_faturamento) as primeira_compra,
      MAX(dt_faturamento) as ultima_compra,
      COALESCE(SUM(CASE WHEN dt_faturamento >= CURRENT_DATE - INTERVAL '12 months' THEN vlr_total_liq ELSE 0 END), 0) as valor_faturado_12m,
      COUNT(CASE WHEN dt_faturamento >= CURRENT_DATE - INTERVAL '12 months' THEN 1 ELSE NULL END)::integer as quantidade_notas_12m
    FROM public.cm_faturamento
    WHERE (status_nfe IS DISTINCT FROM 'CANCELADA')
      AND cod_top IN ('1100', '1117', '1200', '1201', '1703', '1713', '1723')
      AND nome_parceiro NOT IN ('CAFE UTAM S/A', 'COFFEE MAIS INDUSTRIA DE CAFE LTDA')
    GROUP BY cod_parceiro, nome_parceiro
  ),
  faturamento_code AS (
    SELECT 
      cod_parceiro,
      MIN(primeira_compra) as primeira_compra,
      MAX(ultima_compra) as ultima_compra,
      SUM(valor_faturado_12m) as valor_faturado_12m,
      SUM(quantidade_notas_12m) as quantidade_notas_12m
    FROM faturamento_agregado
    GROUP BY cod_parceiro
  ),
  faturamento_name AS (
    SELECT 
      norm_nome,
      MIN(primeira_compra) as primeira_compra,
      MAX(ultima_compra) as ultima_compra,
      SUM(valor_faturado_12m) as valor_faturado_12m,
      SUM(quantidade_notas_12m) as quantidade_notas_12m
    FROM faturamento_agregado
    GROUP BY norm_nome
  ),
  clientes_norm AS (
    SELECT 
      id,
      codigo,
      translate(upper(nome_parceiro), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝŸ', 'AAAAAEEEEIIIIOOOOOUUUUCNYY') as norm_nome
    FROM public.cm_clientes
  )
  SELECT 
    c.id as cliente_id,
    COALESCE(f_code.ultima_compra, f_name.ultima_compra) as ultima_compra,
    COALESCE(f_code.primeira_compra, f_name.primeira_compra) as primeira_compra,
    (CURRENT_DATE - COALESCE(f_code.ultima_compra, f_name.ultima_compra)) as dias_sem_comprar,
    CASE 
      WHEN COALESCE(f_code.ultima_compra, f_name.ultima_compra) IS NULL THEN 'Sem vendas'
      WHEN (CURRENT_DATE - COALESCE(f_code.ultima_compra, f_name.ultima_compra)) <= 90 THEN 'Ativo'
      WHEN (CURRENT_DATE - COALESCE(f_code.ultima_compra, f_name.ultima_compra)) <= 180 THEN 'Atenção'
      ELSE 'Inativo'
    END as situacao_comercial,
    COALESCE(f_code.valor_faturado_12m, f_name.valor_faturado_12m) as valor_faturado_12m,
    COALESCE(f_code.quantidade_notas_12m, f_name.quantidade_notas_12m) as quantidade_notas_12m,
    NOW() as updated_at,
    v_refresh_time as last_refresh_at
  FROM clientes_norm c
  LEFT JOIN faturamento_code f_code ON c.codigo::text = f_code.cod_parceiro
  LEFT JOIN faturamento_name f_name ON c.norm_nome = f_name.norm_nome;

  v_stage_end := clock_timestamp();
  v_duration := v_stage_end - v_stage_start;
  RAISE LOG 'TELEMETRIA SUCCESS: view_refresh, etapa=%, inicio=%, fim=%, duracao=%', v_stage, v_stage_start, v_stage_end, v_duration;
EXCEPTION WHEN OTHERS THEN
  v_stage_end := clock_timestamp();
  v_duration := v_stage_end - v_stage_start;
  RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
  RAISE;
END;
$function$;

-- 5. Atualizar a RPC de refresh geral para orquestrar as duas sub-rotinas
CREATE OR REPLACE FUNCTION public.refresh_materialized_views()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_stage text;
  v_stage_start timestamptz;
  v_stage_end timestamptz;
  v_duration interval;
  r RECORD;
BEGIN
  -- Etapa 1: Refresh da mv_vendas_agg (se existir)
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
    FOR r IN (
       SELECT c.relname as relation_name, a.pid as blocking_pid, a.query as blocking_query, a.state as blocking_state, l.mode as lock_mode, age(clock_timestamp(), a.query_start) as query_duration
       FROM pg_locks l JOIN pg_class c ON l.relation = c.oid JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE c.relname IN ('mv_vendas_agg', 'cm_faturamento') AND a.pid != pg_backend_pid()
    ) LOOP
      RAISE LOG 'TELEMETRIA LOCK: view_refresh, etapa=%, tabela=%, pid=%, query=%, estado=%, duracao_query=%, lock_mode=%', 
                v_stage, r.relation_name, r.blocking_pid, r.blocking_query, r.blocking_state, r.query_duration, r.lock_mode;
    END LOOP;
    RAISE LOG 'TELEMETRIA ERROR: view_refresh, etapa=%, duracao=%, SQLERRM=%, SQLSTATE=%', v_stage, v_duration, SQLERRM, SQLSTATE;
  END;

  -- Etapa 2: Chamar a RPC específica de atividade comercial
  PERFORM public.refresh_clientes_atividade();
END;
$function$;
