require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: 'SELECT DISTINCT channel FROM sales WHERE channel IS NOT NULL ORDER BY channel;' });
  if (error) {
    console.error(error);
  } else {
    console.log("Channels:", data.map(d => d.channel));
  }
}

run();
