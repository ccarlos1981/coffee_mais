require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: salesRows, error: errSales } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT DISTINCT cod_produto, product FROM sales LIMIT 10`
  });

  const { data: prodRows, error: errProd } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT id, name FROM products LIMIT 10`
  });

  console.log('Distinct sales products:', salesRows);
  console.log('Distinct table products:', prodRows);
}

run().catch(console.error);
