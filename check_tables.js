require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Checking row counts...");
  
  const { count: countSales, error: errSales } = await supabase
    .from('sales_v2')
    .select('*', { count: 'exact', head: true });
  console.log(`sales_v2 count: ${errSales ? errSales.message : countSales}`);

  const { count: countSankhya, error: errSankhya } = await supabase
    .from('cm_faturamento_sankhya')
    .select('*', { count: 'exact', head: true });
  console.log(`cm_faturamento_sankhya count: ${errSankhya ? errSankhya.message : countSankhya}`);
}
run();
