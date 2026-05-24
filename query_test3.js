require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.time("Query");
  const { data, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento, base_atendimento!inner(*)')
    .limit(5);
  console.timeEnd("Query");
  console.log("Error:", error);
}
run();
