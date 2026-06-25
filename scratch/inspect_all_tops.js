require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== ALL TOP CODES IN JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        cod_top,
        SUM(vlr_total_liq) as sum_liq,
        SUM(vlr_desconto) as sum_desc,
        SUM(vlr_total_liq - vlr_desconto) as net_fat,
        COUNT(*)
      FROM cm_faturamento_sankhya
      WHERE dt_faturamento >= '2026-06-01' AND dt_faturamento <= '2026-06-30'
        AND (status_nfe IS NULL OR status_nfe != 'CANCELADA')
      GROUP BY cod_top
      ORDER BY sum_liq DESC
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("June 2026 TOP codes:", data);
}
run();
