require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== INSPECTING MELI SALES IN JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        f.nome_vendedor,
        b.manager,
        SUM(f.vlr_total_liq) as sum_liq,
        SUM(f.vlr_desconto) as sum_desc,
        COUNT(*)
      FROM cm_faturamento_sankhya f
      LEFT JOIN base_atendimento b ON b.cod_parceiro = f.cod_parceiro
      WHERE f.dt_faturamento >= '2026-06-01' AND f.dt_faturamento <= '2026-06-30'
        AND f.nome_vendedor = 'MELI'
      GROUP BY f.nome_vendedor, b.manager
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("MELI Sales:", data);
}
run();
