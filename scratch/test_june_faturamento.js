require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("=== CHECKING MV_VENDAS_MENSAL FOR JUNE 2026 ===");
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT manager, SUM(fat) as total_fat, SUM(maco) as total_maco, SUM(qty) as total_qty
      FROM mv_vendas_mensal
      WHERE mes = '2026-06'
      GROUP BY manager
      ORDER BY total_fat DESC
    `
  });
  if (error) {
    console.error("Error executing query:", error);
    return;
  }
  console.log("Results by manager:", data);
  const totalFat = data.reduce((acc, curr) => acc + Number(curr.total_fat), 0);
  const totalMaco = data.reduce((acc, curr) => acc + Number(curr.total_maco), 0);
  console.log("TOTAL FATURAMENTO:", totalFat.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  console.log("TOTAL CONTRIB MARGIN (MACO):", totalMaco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
}
run();
