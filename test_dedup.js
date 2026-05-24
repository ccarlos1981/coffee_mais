require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let from = 0;
  let all = [];
  while(true) {
    const { data, error } = await supabase.from('cm_faturamento_sankhya')
      .select('nome_vendedor, vlr_total_liq, nro_unico')
      .in('nome_vendedor', ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'])
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  
  const deduplicatedData = Array.from(new Map(all.map(r => [r.nro_unico, r])).values());
  
  let sums = {};
  for(let row of deduplicatedData) {
      const v = row.nome_vendedor || 'UNKNOWN';
      sums[v] = (sums[v] || 0) + (row.vlr_total_liq || 0);
  }
  
  const sorted = Object.entries(sums).sort((a,b) => b[1] - a[1]);
  for(let [k, v] of sorted) {
    console.log(`${k}: ${v.toFixed(2)}`);
  }
}
run();
