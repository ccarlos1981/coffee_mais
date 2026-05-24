require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('canal, manager');
  
  const canais = [...new Set(baseData.map(r => r.canal))];
  const managers = [...new Set(baseData.map(r => r.manager))];
  
  console.log("Canais distintos em base_atendimento:", canais);
  console.log("Managers distintos em base_atendimento:", managers);
}
run();
