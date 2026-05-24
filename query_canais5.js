require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT nome_parceiro, SUM(vlr_total_liq) as total 
      FROM cm_faturamento_sankhya 
      WHERE dt_faturamento >= '2026-05-01' AND dt_faturamento <= '2026-05-31'
      GROUP BY nome_parceiro
      ORDER BY total DESC
      LIMIT 20;
    `
  });
  console.log("Top partners overall:", data);
}
run();
