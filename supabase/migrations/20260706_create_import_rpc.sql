CREATE OR REPLACE FUNCTION public.importar_lote_investimentos(
    job_data jsonb,
    acoes_data jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_job_id UUID;
BEGIN
    -- 1. Inserir o job e obter o ID
    INSERT INTO public.cm_import_jobs (
        nome_arquivo, file_hash, registros_count, investimento_total, created_by, status, ip_address
    ) VALUES (
        (job_data->>'nome_arquivo'),
        (job_data->>'file_hash'),
        (job_data->>'registros_count')::integer,
        (job_data->>'investimento_total')::numeric,
        (job_data->>'created_by')::uuid,
        'sucesso',
        (job_data->>'ip_address')
    ) RETURNING id INTO new_job_id;

    -- 2. Inserir todas as ações vinculadas ao job_id
    INSERT INTO public.cm_acoes_investimento (
        rede, codigo_matriz, mes_referencia, data_inicio, data_fim, tipo_acao, tipo_pagamento,
        abrangencia, familia_produto, preco_flat, preco_acao, valor_investimento, expectativa_volume,
        is_planejamento, fase_atual, familias_detalhes, skus_detalhes, import_batch_id
    )
    SELECT 
        (val->>'rede'),
        (val->>'codigo_matriz'),
        (val->>'mes_referencia'),
        (val->>'data_inicio')::date,
        (val->>'data_fim')::date,
        (val->>'tipo_acao'),
        (val->>'tipo_pagamento'),
        (val->>'abrangencia'),
        (val->>'familia_produto'),
        (val->>'preco_flat')::numeric,
        (val->>'preco_acao')::numeric,
        (val->>'valor_investimento')::numeric,
        (val->>'expectativa_volume')::numeric,
        (val->>'is_planejamento')::boolean,
        (val->>'fase_atual')::integer,
        (val->'familias_detalhes'),
        (val->'skus_detalhes'),
        new_job_id
    FROM jsonb_array_elements(acoes_data) AS val;

    RETURN new_job_id;
END;
$$;
