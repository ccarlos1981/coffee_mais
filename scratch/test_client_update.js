const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Updating cm_clientes's codigo_matriz to trigger the loop...");
  const { data, error } = await supabase
    .from('cm_clientes')
    .update({ codigo_matriz: '115251.2', responsavel: 'Julliano', manager_id: '1000' })
    .eq('codigo', 141544)
    .select();

  if (error) {
    console.error("Error updating cm_clientes:", error);
  } else {
    console.log("Success updating cm_clientes:", data);
  }
}

run();
