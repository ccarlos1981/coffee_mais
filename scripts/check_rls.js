require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname = 'cm_faturamento_sankhya';
    `
  });
  console.log(data, error);
}
run();
