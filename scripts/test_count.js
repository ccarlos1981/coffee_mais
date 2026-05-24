require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { count, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('*', { count: 'exact', head: true })
    .gte('dt_faturamento', '2025-01-01')
    .lte('dt_faturamento', '2025-01-31');
  console.log('Jan 2025 count:', count);
}
run();
