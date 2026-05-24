require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('cm_faturamento_sankhya')
    .select('cfop_desc, desc_top, status_nfe, sum:vlr_total_liq')
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');

  let byTop = {};
  for(const row of data||[]) {
    const key = `${row.desc_top} | ${row.status_nfe}`;
    byTop[key] = (byTop[key] || 0) + (row.sum || 0);
  }
  for (const k in byTop) {
     console.log(k, (byTop[k] / 1000).toLocaleString('pt-BR'));
  }
}
run();
