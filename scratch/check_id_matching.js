require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT s.cod_produto, s.product as sales_product, p.id as product_id, p.name as product_name
      FROM sales s
      JOIN products p ON UPPER(TRIM(s.product)) = UPPER(TRIM(p.name))
      LIMIT 10
    `
  });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Joined rows:', data);
  }
}

run().catch(console.error);
