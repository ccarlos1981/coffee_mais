-- Migration: 20260822_import_hub_idempotency.sql
-- Demanda 065: Proteção de idempotência para o Import Hub
-- Garante que retry de chunks durante staging não cria duplicatas

-- 1. Adicionar colunas row_index e row_hash à staging para deduplicação técnica de ingestão
-- A chave de negócio (nro_unico|nro_nota|cod_parceiro|cod_produto) NÃO é 100% única no CSV
-- (existem ~142 linhas legítimas idênticas no relatório Sankhya para pedidos com múltiplos itens do mesmo SKU)
-- Portanto, usa-se a chave técnica de ingestão (batch_id, row_index) para garantir que cada linha do CSV
-- é persistida exatamente 1 vez, e retries do mesmo chunk são 100% idempotentes.

ALTER TABLE public.cm_faturamento_staging
  ADD COLUMN IF NOT EXISTS row_index integer,
  ADD COLUMN IF NOT EXISTS row_hash text;

-- 2. Criar índice UNIQUE para deduplicação técnica por (batch_id, row_index)
DROP INDEX IF EXISTS public.uidx_staging_batch_row_hash;
DROP INDEX IF EXISTS public.uidx_staging_batch_row_index;

CREATE UNIQUE INDEX uidx_staging_batch_row_index
  ON public.cm_faturamento_staging (batch_id, row_index)
  WHERE row_index IS NOT NULL;

-- 3. Atualizar fn_bulk_insert_staging com ON CONFLICT (batch_id, row_index) DO NOTHING
-- para que retries de chunks sejam intrinsecamente idempotentes no nível do banco
CREATE OR REPLACE FUNCTION public.fn_bulk_insert_staging(p_rows jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $$
DECLARE
  v_count bigint;
BEGIN
  INSERT INTO public.cm_faturamento_staging (
    batch_id, cod_cfop, cfop_desc, dt_faturamento, nro_unico, nro_nota,
    cod_parceiro, nome_parceiro, cod_produto, desc_produto, quantidade,
    vlr_unitario, vlr_desconto, vlr_total_liq, cod_top, desc_top,
    custo_icms, cod_vendedor, nome_vendedor, controle, custo_total,
    cod_natureza, desc_natureza, status_nfe, vlr_frete, vlr_substituicao,
    vlr_total_st, cod_cr, centro_resultado, valor_venda_futura, validation_status,
    row_index, row_hash
  )
  SELECT 
    (r.batch_id)::uuid,
    r.cod_cfop,
    r.cfop_desc,
    r.dt_faturamento,
    r.nro_unico,
    r.nro_nota,
    r.cod_parceiro,
    r.nome_parceiro,
    r.cod_produto,
    r.desc_produto,
    r.quantidade,
    r.vlr_unitario,
    r.vlr_desconto,
    r.vlr_total_liq,
    r.cod_top,
    r.desc_top,
    r.custo_icms,
    r.cod_vendedor,
    r.nome_vendedor,
    r.controle,
    r.custo_total,
    r.cod_natureza,
    r.desc_natureza,
    r.status_nfe,
    r.vlr_frete,
    r.vlr_substituicao,
    r.vlr_total_st,
    r.cod_cr,
    r.centro_resultado,
    COALESCE(r.valor_venda_futura, 0),
    COALESCE(r.validation_status, 'VALID'),
    r.row_index,
    r.row_hash
  FROM jsonb_to_recordset(p_rows) AS r(
    batch_id text, cod_cfop text, cfop_desc text, dt_faturamento date, nro_unico text, nro_nota text,
    cod_parceiro text, nome_parceiro text, cod_produto text, desc_produto text, quantidade numeric,
    vlr_unitario numeric, vlr_desconto numeric, vlr_total_liq numeric, cod_top text, desc_top text,
    custo_icms numeric, cod_vendedor text, nome_vendedor text, controle text, custo_total numeric,
    cod_natureza text, desc_natureza text, status_nfe text, vlr_frete numeric, vlr_substituicao numeric,
    vlr_total_st numeric, cod_cr text, centro_resultado text, valor_venda_futura numeric, validation_status text,
    row_index integer, row_hash text
  )
  ON CONFLICT (batch_id, row_index) WHERE row_index IS NOT NULL
  DO NOTHING;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_bulk_insert_staging(jsonb) TO anon, authenticated, service_role;

-- 4. Limpar staging residual de batches anteriores (housekeeping)
DELETE FROM public.cm_faturamento_staging
WHERE batch_id NOT IN (
  SELECT id FROM public.cm_sync_logs WHERE status = 'RUNNING'
);
