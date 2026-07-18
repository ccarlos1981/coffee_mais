const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Updating base_atendimento manager...");
  const { data, error } = await supabase
    .from('base_atendimento')
    .update({ manager: 'Julliano', updated_at: new Date().toISOString() })
    .eq('cod_parceiro', '19838')
    .select();

  if (error) {
    console.error("Error updating base_atendimento:", error);
  } else {
    console.log("Success updating base_atendimento:", data);
  }
}

run();
