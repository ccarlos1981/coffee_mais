const fs = require('fs');

const sparklineFile = 'src/app/api/dashboard/sparkline/route.ts';
let content = fs.readFileSync(sparklineFile, 'utf8');

const replacement = `WITH sales_enriched AS (
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
        0 as receita_frete
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    )
    SELECT`;

content = content.replace('SELECT\n        COALESCE', replacement + '\n        COALESCE');
fs.writeFileSync(sparklineFile, content);
console.log('Updated', sparklineFile);
