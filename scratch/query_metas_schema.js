require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cm_promotor_metas' AND table_schema = 'public'`
  });

  if (error) {
    console.error('Error fetching columns:', error);
  } else {
    console.log('Columns in cm_promotor_metas:', data);
  }
}

run().catch(console.error);
