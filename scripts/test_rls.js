require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Test with ANON key (no service role)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: data1, error: err1 } = await supabase.from('cm_faturamento_sankhya').select('count', { count: 'exact', head: true });
  console.log('cm_faturamento_sankhya anon count:', data1, err1);

  const { data: data2, error: err2 } = await supabase.from('base_atendimento').select('count', { count: 'exact', head: true });
  console.log('base_atendimento anon count:', data2, err2);
}
run();
