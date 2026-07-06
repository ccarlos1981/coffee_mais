require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('=== MONITOR DE LOGS DE IMPORTAÇÃO DE FATURAMENTO ===\n');

  const { data, error } = await supabase
    .from('cm_sync_logs')
    .select('id, started_at, finished_at, status, source, period_start, period_end, rows_fetched, rows_inserted, error_message, metadata')
    .order('started_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro ao consultar cm_sync_logs:', error.message);
    return;
  }

  data.forEach((log, index) => {
    console.log(`[${index + 1}] ID: ${log.id}`);
    console.log(`    Origem: ${log.source} | Status: ${log.status}`);
    console.log(`    Início: ${log.started_at} | Fim: ${log.finished_at || 'Em andamento...'}`);
    console.log(`    Período: ${log.period_start || 'N/A'} até ${log.period_end || 'N/A'}`);
    console.log(`    Linhas Lidas: ${log.rows_fetched} | Inseridas: ${log.rows_inserted}`);
    if (log.error_message) {
      console.log(`    ❌ Erro: ${log.error_message}`);
    }
    if (log.metadata) {
      const meta = log.metadata;
      if (meta.file_name) console.log(`    Arquivo: ${meta.file_name}`);
      if (meta.current_step) console.log(`    Etapa Atual: ${meta.current_step} (${meta.progress || 0}%)`);
      if (meta.logs && meta.logs.length > 0) {
        console.log(`    Histórico de Passos:`);
        meta.logs.forEach(step => {
          console.log(`      - [${step.timestamp}] ${step.step} (${step.progress || 0}%)`);
        });
      }
    }
    console.log('-'.repeat(60));
  });
}

run().catch(console.error);
