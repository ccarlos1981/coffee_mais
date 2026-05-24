require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT nome_vendedor, SUM(vlr_total_liq) as total 
      FROM cm_faturamento_sankhya 
      WHERE dt_faturamento >= '2026-05-01' AND dt_faturamento <= '2026-05-31'
      GROUP BY nome_vendedor
    `
  });
  if (error) {
    // try the JS way if RPC fails
    let from = 0;
    let map = {};
    while(true) {
      const {data: rows, error: err} = await supabase.from('cm_faturamento_sankhya').select('nome_vendedor, vlr_total_liq').gte('dt_faturamento', '2026-05-01').lte('dt_faturamento', '2026-05-31').range(from, from + 999);
      if (err || !rows || rows.length === 0) break;
      for (const r of rows) {
        map[r.nome_vendedor] = (map[r.nome_vendedor] || 0) + (r.vlr_total_liq || 0);
      }
      from += 1000;
    }
    console.log("Vendedores:", Object.entries(map).sort((a,b) => b[1] - a[1]));
  } else {
    console.log(data);
  }
}
run();
