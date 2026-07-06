require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT id, name, type, weight FROM products WHERE name ILIKE '%1kg%' OR weight ILIKE '%1kg%'`
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('1kg products:', data);
  }
}

run().catch(console.error);
