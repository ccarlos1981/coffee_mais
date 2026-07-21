const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function checkMigration() {
  console.log('=== VERIFICAÇÃO DE ESTRUTURA DO BANCO DE DADOS ===');

  // Check columns of cm_faturamento_staging
  const { data: sampleStaging, error: errStaging } = await supabase.from('cm_faturamento_staging').select('*').limit(1);
  console.log('Staging query error:', errStaging);
  if (sampleStaging && sampleStaging.length > 0) {
    console.log('Colunas em cm_faturamento_staging:', Object.keys(sampleStaging[0]));
    console.log('valor_venda_futura em staging?', 'valor_venda_futura' in sampleStaging[0]);
  } else {
    // Try inserting a dummy row to test column or select with rpc execute_readonly_query
    const { data: colsStaging } = await supabase.rpc('execute_readonly_query', {
      query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'cm_faturamento_staging'"
    });
    console.log('Colunas de cm_faturamento_staging:', colsStaging ? colsStaging.map(c => c.column_name) : 'none');
  }

  // Check columns of cm_faturamento
  const { data: colsFaturamento } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'cm_faturamento'"
  });
  console.log('\nColunas de cm_faturamento:', colsFaturamento ? colsFaturamento.map(c => c.column_name) : 'none');

  // Check views
  const { data: colsSankhya } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'cm_faturamento_sankhya'"
  });
  console.log('\nColunas de cm_faturamento_sankhya:', colsSankhya ? colsSankhya.map(c => c.column_name) : 'none');

  const { data: colsMvAgg } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'mv_vendas_agg'"
  });
  console.log('\nColunas de mv_vendas_agg:', colsMvAgg ? colsMvAgg.map(c => c.column_name) : 'none');

  const { data: colsMvMensal } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name FROM information_schema.columns WHERE table_name = 'mv_vendas_mensal'"
  });
  console.log('\nColunas de mv_vendas_mensal:', colsMvMensal ? colsMvMensal.map(c => c.column_name) : 'none');
}

checkMigration().catch(console.error);
