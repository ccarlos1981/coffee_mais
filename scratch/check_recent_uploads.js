require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== CHECKING E-COMMERCE ON JUNE 22, 2026 ===");

  const { data } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT cod_cfop, SUM(vlr_total_liq) as total, COUNT(*)
      FROM cm_faturamento_sankhya
      WHERE dt_faturamento = '2026-06-22'
        AND nome_vendedor IN ('SHOPIFY', 'LIVELO')
        AND (status_nfe IS NULL OR status_nfe != 'CANCELADA')
        AND cod_top = '1100'
      GROUP BY cod_cfop
    `
  });
  console.log("June 22 E-commerce:", data);
}
run();
