const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPace() {
  const { data: salesCols, error: errCols } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT * FROM public.sales LIMIT 1`
  });
  console.log('Sample sales row keys:', salesCols && salesCols[0] ? Object.keys(salesCols[0]) : null);

  const { data: maxDayData } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT MAX(dia) as max_day FROM public.sales WHERE ano = '2026' AND mes = '07'`
  });
  console.log('Max day July 2026:', maxDayData);

  const { data: julSales } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT SUM(fat) as total_fat FROM public.mv_vendas_mensal WHERE mes = '2026-07'`
  });
  console.log('July 2026 mv_vendas_mensal SUM(fat):', julSales);

  const { data: junRemData } = await supabase.rpc('execute_readonly_query', {
    query_text: `SELECT SUM(net_value) as rem_fat, SUM(quantity) as rem_qty FROM public.sales WHERE ano = '2026' AND mes = '06' AND dia >= 24`
  });
  console.log('June 2026 remainder (dia >= 24):', junRemData);
}

testPace().catch(console.error);
