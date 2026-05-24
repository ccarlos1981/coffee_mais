require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.time("Query");
  const { data, count, error } = await supabase
    .from('cm_faturamento_sankhya')
    .select('dt_faturamento', { count: 'exact' })
    .gte('dt_faturamento', '2026-05-01')
    .lte('dt_faturamento', '2026-05-31');
  console.timeEnd("Query");
  console.log("Count for May 2026:", count);
  console.log("Error:", error);
}
run();
