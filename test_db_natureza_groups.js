require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let from = 0;
  let allRows = [];
  while(true) {
    const { data, error } = await supabase.from('cm_faturamento_sankhya')
      .select('nome_vendedor, vlr_total_liq, cod_natureza, cod_top')
      .in('nome_vendedor', ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'])
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  
  let groups = {};
  for(let row of allRows) {
    const key = `TOP: ${row.cod_top} | Nat: ${row.cod_natureza}`;
    groups[key] = (groups[key] || 0) + row.vlr_total_liq;
  }
  
  const sorted = Object.entries(groups).sort((a,b) => b[1] - a[1]);
  for(let [k, v] of sorted) {
    console.log(`${k}: ${v.toFixed(2)}`);
  }
}
run();
