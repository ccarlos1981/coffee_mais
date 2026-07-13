require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const views = [
    'vw_sales_summary',
    'vw_matrix_ranking',
    'sales',
    'view_redes_disponiveis',
    'v_produtos_detalhes',
    'v_redes_matrizes_detalhes',
    'v_metrics_roi_campanha',
    'v_metrics_roi_rede',
    'v_metrics_tempo_ciclo',
    'v_metrics_roi_familia',
    'v_acoes_investimento_com_gerente'
  ];

  for (const view of views) {
    const { data, error } = await supabase.rpc('execute_readonly_query', {
      query_text: `SELECT view_definition FROM information_schema.views WHERE table_name = '${view}'`
    });

    if (error) {
      console.error(`Error fetching ${view}:`, error);
    } else {
      console.log(`=== VIEW: ${view} ===`);
      console.log(data[0]?.view_definition || 'No definition found');
      console.log('\n');
    }
  }
}

run().catch(console.error);
