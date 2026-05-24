require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('*');
  const baseMap = {};
  for(let row of baseData) {
    baseMap[row.cod_parceiro] = row;
  }
  
  const { data, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('cod_parceiro, vlr_total_liq')
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');
    
  if (error) {
    console.error(error);
    return;
  }
  
  // Aggregate sales by channel
  const salesByChannel = {};
  let notInBase = 0;
  for (const row of data) {
    const base = baseMap[row.cod_parceiro];
    if (base) {
      const channel = base.canal || 'Unknown';
      salesByChannel[channel] = (salesByChannel[channel] || 0) + (row.vlr_total_liq || 0);
    } else {
      notInBase += (row.vlr_total_liq || 0);
    }
  }
  
  console.log("Sales by channel in first 1000 rows:", salesByChannel);
  console.log("Not in base:", notInBase);
}
run();
