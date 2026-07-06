-- 1. Rename table to fit standard domain naming and avoid source lock-in
ALTER TABLE cm_faturamento_sankhya RENAME TO cm_faturamento;

-- 2. Add columns to cm_faturamento for origin and batch tracking
ALTER TABLE cm_faturamento ADD COLUMN IF NOT EXISTS origem text DEFAULT 'EXCEL';
ALTER TABLE cm_faturamento ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES cm_sync_logs(id) ON DELETE CASCADE;

-- 3. Create indices for fast batch operations and queries
CREATE INDEX IF NOT EXISTS idx_faturamento_batch_id ON cm_faturamento(batch_id);

-- 4. Create staging table cm_faturamento_staging
CREATE TABLE IF NOT EXISTS cm_faturamento_staging (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid REFERENCES cm_sync_logs(id) ON DELETE CASCADE,
    cod_cfop text,
    cfop_desc text,
    dt_faturamento date,
    nro_unico text,
    nro_nota text,
    cod_parceiro text,
    nome_parceiro text,
    cod_produto text,
    desc_produto text,
    quantidade numeric,
    vlr_unitario numeric,
    vlr_desconto numeric,
    vlr_total_liq numeric,
    vlr_bruto numeric,
    vlr_devolucao numeric,
    cod_top text,
    desc_top text,
    custo_icms numeric,
    cod_vendedor text,
    nome_vendedor text,
    controle text,
    custo_total numeric,
    cod_natureza text,
    desc_natureza text,
    status_nfe text,
    vlr_frete numeric,
    vlr_substituicao numeric,
    vlr_total_st numeric,
    cod_cr text,
    centro_resultado text,
    validation_status text DEFAULT 'VALID',
    validation_message text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faturamento_staging_batch ON cm_faturamento_staging(batch_id);

-- 5. Create backwards compatibility view for existing dashboards and dependencies
CREATE OR REPLACE VIEW cm_faturamento_sankhya AS 
SELECT 
    id,
    cod_cfop,
    cfop_desc,
    dt_faturamento,
    nro_unico,
    nro_nota,
    cod_parceiro,
    nome_parceiro,
    cod_produto,
    desc_produto,
    quantidade,
    vlr_unitario,
    vlr_desconto,
    vlr_total_liq,
    cod_top,
    desc_top,
    custo_icms,
    cod_vendedor,
    nome_vendedor,
    controle,
    custo_total,
    cod_natureza,
    desc_natureza,
    status_nfe,
    vlr_frete,
    vlr_substituicao,
    vlr_total_st,
    cod_cr,
    centro_resultado,
    created_at,
    updated_at,
    chave_bq
FROM cm_faturamento;
