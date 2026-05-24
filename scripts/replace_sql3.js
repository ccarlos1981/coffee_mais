const fs = require('fs');

const metaFile = 'src/app/api/dashboard/meta-cia/route.ts';
let content = fs.readFileSync(metaFile, 'utf8');

const replacement = `    WITH sales_enriched AS (
      SELECT 
        b.manager, 
        b.rede, 
        f.nome_parceiro, 
        f.desc_produto as product, 
        f.dt_faturamento as invoice_date, 
        COALESCE(CAST(f.vlr_total_liq AS numeric), 0) as net_value,
        COALESCE(CAST(f.quantidade AS numeric), 0) as quantity,
        (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0)) as imposto,
        COALESCE(CAST(f.custo_total AS numeric), 0) as custo_total,
        COALESCE(CAST(f.vlr_frete AS numeric), 0) as custo_frete,
        0 as receita_frete,
        b.canal as channel
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    ),
    raw_sales AS (`;

if (content.includes('WITH raw_sales AS (')) {
  content = content.replace('WITH raw_sales AS (', replacement);
  fs.writeFileSync(metaFile, content);
  console.log('Updated meta-cia');
}

const pMatrizFile = 'src/app/api/dashboard/positivacao-matriz/route.ts';
let pContent = fs.readFileSync(pMatrizFile, 'utf8');

// The positivacao-matriz uses a JS Supabase query instead of RAW SQL:
// const { data, error } = await supabase.from('sales_enriched').select(...)
// Wait! Let me check how it works exactly.
