require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('cm_skus_conversao')
    .select('count')
    .limit(1);

  if (error) {
    console.log('Table does not exist or error:', error.message);
  } else {
    console.log('Table exists! Response:', data);
  }
}

run().catch(console.error);
