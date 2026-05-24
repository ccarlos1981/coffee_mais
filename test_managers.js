require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('cod_parceiro, manager');
  const baseMap = new Map();
  for (const row of baseData) {
    if (row.cod_parceiro) baseMap.set(String(row.cod_parceiro), row.manager);
  }

  const { data, error } = await supabase.from('cm_faturamento_sankhya')
    .select('vlr_total_liq, cod_parceiro')
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');

  if(error) console.error(error);
  
  let totals = { 'Leandro': 0, 'Luiz': 0, 'Julliano': 0, 'Inside Sales': 0 };
  
  for(let row of data || []) {
     const mgr = baseMap.get(String(row.cod_parceiro));
     if(mgr && totals[mgr] !== undefined) {
         totals[mgr] += row.vlr_total_liq || 0;
     }
  }
  
  for (const m in totals) {
     console.log(m, (totals[m] / 1000).toLocaleString('pt-BR'));
  }
}
run();
