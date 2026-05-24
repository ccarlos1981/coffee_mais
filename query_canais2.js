require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('nome_parceiro, vlr_total_liq')
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');
    
  if (error) {
    console.error(error);
    return;
  }
  
  // Aggregate sales by partner
  const salesByPartner = {};
  for (const row of data) {
    if (!salesByPartner[row.nome_parceiro]) salesByPartner[row.nome_parceiro] = 0;
    salesByPartner[row.nome_parceiro] += row.vlr_total_liq || 0;
  }
  
  const sorted = Object.entries(salesByPartner).sort((a,b) => b[1] - a[1]).slice(0, 30);
  console.log("Top partners in May 2026:", sorted);
}
run();
