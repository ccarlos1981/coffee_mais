require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Truncating table cm_faturamento_sankhya...');
  const { error } = await supabase.rpc('truncate_cm_faturamento_sankhya');
  // if rpc doesn't exist, we can't easily truncate. Supabase REST API doesn't support TRUNCATE.
  // We can delete by matching all via ID? Wait, delete all could time out.
  // Alternatively we can use psql.
}
run();
