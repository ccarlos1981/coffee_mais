const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log("=== RUNNING RPC QUERY AUDIT ===");

  const year = 2026;
  const month = 7;
  const curMonthKey = "2026-07";
  const prevMonthKey = "2026-06";
  const prevYearKey = "2025-07";
  const closedMonth2 = "2026-05";
  const closedMonth3 = "2026-04";

  const sqlClientHistory = `
    SELECT 
      mes,
      CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END as manager,
      COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
      SUM(fat) as fat
    FROM mv_vendas_cliente_mensal
    WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonth2}', '${closedMonth3}')
    GROUP BY mes, CASE WHEN manager = 'Leandro Saffi' THEN 'Leandro' ELSE COALESCE(manager, 'Outros') END, COALESCE(rede, nome_parceiro, 'Não Mapeado')
  `;

  console.log("Executing sqlClientHistory via RPC...");
  const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory });

  if (error) {
    console.error("RPC Error:", error);
    process.exit(1);
  }

  console.log(`Total rows returned by RPC: ${rows.length}`);

  const leandroRows = rows.filter((r) => r.manager === 'Leandro');
  console.log(`\nLeandro rows (${leandroRows.length} found):`);
  leandroRows.forEach((r) => {
    console.log(`  Mes: ${r.mes}, Client: ${r.client}, Fat: ${r.fat}`);
  });
}

run();
