require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const from = '2025-01-01';
  const to = '2025-04-30';
  
  // Get base map
  const map = new Map();
  const { data } = await supabase.from('base_atendimento').select('*');
  for (const row of data) {
    if (row.cod_parceiro) map.set(String(row.cod_parceiro), row);
  }
  
  console.log(`Base map length: ${map.size}`);
  
  // Get sales
  const { data: sales, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('*')
    .gte('dt_faturamento', from)
    .lte('dt_faturamento', to)
    .limit(10);
    
  if (error) {
    console.error('Error fetching sales:', error);
    return;
  }
  console.log(`Sales rows found (limit 10): ${sales.length}`);
  if (sales.length > 0) {
    console.log(sales[0]);
    const b = map.get(String(sales[0].cod_parceiro));
    console.log('Mapped base:', b?.manager, b?.rede);
  }
}
run();
