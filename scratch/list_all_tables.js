require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  });

  if (error) {
    console.error('Error fetching tables:', error);
  } else {
    console.log('Tables:', data.map(t => t.table_name));
  }
}

run().catch(console.error);
