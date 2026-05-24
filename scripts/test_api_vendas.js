require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // First, check how many records exist for May 2026
  const { data: countData, error: countErr } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento', { count: 'exact' })
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');

  console.log('Total sales in May 2026:', countData?.length, 'Exact count:', countData?.count, 'Error:', countErr);

  // Check how many records overall
  const { data: c2, error: e2 } = await supabase
    .from('cm_faturamento_sankhya')
    .select('*', { count: 'exact', head: true });
  console.log('Total sales overall:', c2, 'Error:', e2);

  // Check dates format in db
  const { data: dates } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento')
    .limit(5);
  console.log('Sample dates:', dates);
}
run();
