require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('cod_parceiro, base_atendimento!inner(manager, canal, uf, rede)')
    .limit(1);
  console.log(JSON.stringify({ data, error }, null, 2));
}
run();
