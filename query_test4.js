require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('cod_parceiro');
  const validCodes = baseData.map(r => r.cod_parceiro).filter(Boolean);
  
  console.log("Total valid codes:", validCodes.length);
  
  console.time("Query IN");
  const { data, count, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento', { count: 'exact' })
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31')
    .in('cod_parceiro', validCodes);
  console.timeEnd("Query IN");
  console.log("Count with IN filter:", count);
  console.log("Error:", error?.message);
}
run();
