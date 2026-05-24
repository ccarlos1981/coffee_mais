require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let from = 0;
  let sums = {};
  while(true) {
    const { data, error } = await supabase.from('cm_faturamento_sankhya')
      .select('nome_vendedor, vlr_total_liq')
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    for(let row of data) {
      const v = row.nome_vendedor || 'UNKNOWN';
      sums[v] = (sums[v] || 0) + (row.vlr_total_liq || 0);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  
  const sorted = Object.entries(sums).sort((a,b) => b[1] - a[1]);
  for(let [k, v] of sorted) {
    if (v > 10000) console.log(`${k}: ${v.toFixed(2)}`);
  }
}
run();
