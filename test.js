const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('sales').select('manager, rede, nome_parceiro, tipo_produto, net_value').limit(5);
  console.log(data);
}
run();
