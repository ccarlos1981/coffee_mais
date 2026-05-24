const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/api/dashboard/**/*.ts');
const replacement = `
    WITH sales_enriched AS (
      SELECT 
        b.manager, 
        b.rede, 
        f.nome_parceiro, 
        CASE 
          WHEN UPPER(f.desc_produto) LIKE '%1KG%' THEN '1 KG'
          WHEN UPPER(f.desc_produto) LIKE '%5KG%' OR UPPER(f.desc_produto) LIKE '%5 KG%' THEN '5 KG'
          WHEN UPPER(f.desc_produto) LIKE '%CAPSULA%' OR UPPER(f.desc_produto) LIKE '%CÁPSULA%' THEN 'Cápsula'
          WHEN UPPER(f.desc_produto) LIKE '%DRIP%' THEN 'Drip'
          WHEN UPPER(f.desc_produto) LIKE '%GEISHA%' THEN 'Geisha'
          WHEN UPPER(f.desc_produto) LIKE '%VERDE%' THEN 'Café Verde'
          WHEN UPPER(f.desc_produto) LIKE '%GRAO%' OR UPPER(f.desc_produto) LIKE '%GRÃO%' THEN 'Grão'
          WHEN UPPER(f.desc_produto) LIKE '%MOIDO%' OR UPPER(f.desc_produto) LIKE '%MOÍDO%' THEN 'Moído'
          WHEN UPPER(f.desc_produto) LIKE '%ACESSORIO%' OR UPPER(f.desc_produto) LIKE '%GARRAFA%' OR UPPER(f.desc_produto) LIKE '%CANECA%' OR UPPER(f.desc_produto) LIKE '%KIT%' THEN 'Acessório'
          ELSE 'Outros'
        END as tipo_produto,
        f.desc_produto as product, 
        f.dt_faturamento as invoice_date, 
        COALESCE(CAST(f.vlr_total_liq AS numeric), 0) as net_value,
        COALESCE(CAST(f.quantidade AS numeric), 0) as quantity,
        (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0)) as imposto,
        COALESCE(CAST(f.custo_total AS numeric), 0) as custo_total,
        COALESCE(CAST(f.vlr_frete AS numeric), 0) as custo_frete,
        b.uf,
        b.canal as channel
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    ),`;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  if (content.includes('WITH filtered_sales AS (')) {
    content = content.replace('WITH filtered_sales AS (', replacement + '\n    filtered_sales AS (');
    changed = true;
  } else if (content.includes('WITH') && content.includes('sales_enriched')) {
    // Other cases
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
}
