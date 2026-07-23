const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFilters() {
  const { data: resManagers } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT DISTINCT manager, manager_id FROM mv_vendas_mensal WHERE manager IS NOT NULL ORDER BY manager`
  });

  const managers = resManagers.map(r => r.manager);
  console.log('Retorno corrigido de managers:');
  console.log(JSON.stringify(managers, null, 2));

  const hasObject = managers.some(m => typeof m === 'object' || String(m).includes('[object Object]'));
  console.log('\nContém [object Object]?', hasObject ? 'SIM 🔴' : 'NÃO 🟢');
}

testFilters();
