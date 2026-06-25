require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== INSPECTING E-COMMERCE FOR JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        cod_top,
        SUM(vlr_total_liq) as total_liq,
        SUM(vlr_desconto) as total_desconto,
        SUM(vlr_total_liq - vlr_desconto) as net_diff,
        COUNT(*) as cnt
      FROM cm_faturamento_sankhya
      WHERE dt_faturamento >= '2026-06-01' AND dt_faturamento <= '2026-06-30'
        AND nome_vendedor IN ('SHOPIFY', 'LIVELO')
        AND (status_nfe IS NULL OR status_nfe != 'CANCELADA')
      GROUP BY cod_top
      ORDER BY cod_top
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("June 2026 Ecommerce by TOP:", data);
}
run();
