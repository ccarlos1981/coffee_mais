const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Inserting pdv with anon key...");
  const randomCnpj = `99.999.999/9999-${Math.floor(Math.random() * 90 + 10)}`;
  const { data, error } = await supabase
    .from('pdvs')
    .insert({
      cnpj: randomCnpj,
      name: 'Teste Novo PDV',
      network_id: 1,
      erp_code: 'TEST-ERP',
      status: 'active'
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting pdv:", error);
  } else {
    console.log("Success inserting pdv:", data);
  }
}

run();
