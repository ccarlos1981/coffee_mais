const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      id,
      invoice_date,
      network_uf,
      net_value,
      network_matrix (
        matriz,
        gerente
      )
    `)
    .limit(10);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}

run();
