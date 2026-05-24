require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase.from('cm_faturamento_sankhya').select('cod_natureza, cod_top').limit(100);
  const naturezas = new Set(data.map(d => d.cod_natureza));
  const tops = new Set(data.map(d => d.cod_top));
  console.log('Naturezas:', Array.from(naturezas));
  console.log('Tops:', Array.from(tops));
}
run();
