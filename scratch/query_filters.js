require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('get_dashboard_filters_rpc');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Filters keys:', Object.keys(data));
    console.log('Products filters samples:', data.produtos ? data.produtos.slice(0, 3) : null);
  }
}

run().catch(console.error);
