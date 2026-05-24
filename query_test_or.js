require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('cod_parceiro');
  const validCodes = baseData.map(r => r.cod_parceiro).filter(Boolean);
  
  const vends = ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'];
  
  console.time("Query OR");
  const { data, count, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento', { count: 'exact' })
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31')
    .or(`cod_parceiro.in.(${validCodes.join(',')}),nome_vendedor.in.(${vends.join(',')})`);
  console.timeEnd("Query OR");
  console.log("Count:", count);
  console.log("Error:", error?.message);
}
run();
