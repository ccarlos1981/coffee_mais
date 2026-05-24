require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('base_atendimento').select('canal, manager');
  if (error) console.error(error);
  const map = {};
  for(let row of data || []) {
    const key = `${row.canal} - ${row.manager}`;
    map[key] = (map[key] || 0) + 1;
  }
  console.log("Canal - Manager combinations:", map);
}
run();
