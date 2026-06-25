require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== INSPECTING B2B SALES FOR JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        b.manager,
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
        AND f.nome_parceiro != 'CAFE UTAM S/A'
        AND f.nome_parceiro != 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'
      GROUP BY b.manager, f.cod_top
      ORDER BY b.manager, net_fat DESC
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("B2B faturamento by manager & TOP:", data);
}
run();
