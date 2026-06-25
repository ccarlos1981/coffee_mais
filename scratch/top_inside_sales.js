require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== TOP 10 INSIDE SALES PARTNERS IN JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        f.nome_parceiro,
        f.cod_top,
        SUM(f.vlr_total_liq) as sum_liq,
        SUM(f.vlr_desconto) as sum_desc,
        SUM(f.vlr_total_liq - f.vlr_desconto) as net_fat,
        COUNT(*)
      FROM cm_faturamento_sankhya f
      LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
      WHERE f.dt_faturamento >= '2026-06-01' AND f.dt_faturamento <= '2026-06-30'
        AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
        AND f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI')
        AND b.manager = 'Inside Sales'
      GROUP BY f.nome_parceiro, f.cod_top
      ORDER BY net_fat DESC
      LIMIT 10
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log(data);
}
run();
