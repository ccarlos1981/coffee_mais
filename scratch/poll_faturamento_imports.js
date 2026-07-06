require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

let lastLogId = null;
let lastLogStatus = null;
let lastProgress = null;

async function pollOnce() {
  const { data, error } = await supabase
    .from('cm_sync_logs')
    .select('id, started_at, status, source, error_message, metadata')
    .order('started_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Erro ao consultar logs:', error.message);
    return;
  }

  if (data && data.length > 0) {
    const log = data[0];
    const progress = log.metadata?.progress || 0;
    const currentStep = log.metadata?.current_step || 'N/A';
    const fileName = log.metadata?.file_name || 'N/A';

    // Se é um lote novo
    if (log.id !== lastLogId) {
      lastLogId = log.id;
      lastLogStatus = log.status;
      lastProgress = progress;

      console.log(`\n[NOVO LOTE DETECTADO]`);
      console.log(`- ID: ${log.id}`);
      console.log(`- Origem: ${log.source}`);
      console.log(`- Arquivo: ${fileName}`);
      console.log(`- Início: ${log.started_at}`);
      console.log(`- Status Inicial: ${log.status} | Etapa: ${currentStep} (${progress}%)`);
    } 
    // Se mudou de status ou progresso
    else if (log.status !== lastLogStatus || progress !== lastProgress) {
      lastLogStatus = log.status;
      lastProgress = progress;

      console.log(`[ATUALIZAÇÃO DE STATUS]`);
      console.log(`- ID: ${log.id}`);
      console.log(`- Status: ${log.status} | Etapa: ${currentStep} (${progress}%)`);
      if (log.error_message) {
        console.log(`- ❌ Mensagem de Erro: ${log.error_message}`);
      }
    }
  }
}

console.log('=== INICIANDO POLLE DE LOGS DE IMPORTAÇÃO DE FATURAMENTO ===');
console.log('Monitorando novos lotes ou mudanças de status a cada 2 segundos...');

// Polling interval
const interval = setInterval(pollOnce, 2000);

// Stop after 5 minutes to prevent infinite process in test runner, or run indefinitely if needed
setTimeout(() => {
  clearInterval(interval);
  console.log('\n=== MONITOR FINALIZADO (TIMEOUT DE 5 MINUTOS) ===');
}, 300000);
