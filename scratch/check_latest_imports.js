require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('--- MONITOR DE IMPORTAÇÕES: ESTADO ATUAL ---');
  
  // 1. Upload Batches (vendas, etc)
  const { data: batches, error: errBatches } = await supabase
    .from('upload_batches')
    .select('id, filename, status, records_processed, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (errBatches) {
    console.error('Erro ao ler upload_batches:', errBatches.message);
  } else {
    console.log('\nLast 3 upload_batches:');
    console.table(batches);
  }

  // 2. DRE Import Logs
  const { data: dreLogs, error: errDre } = await supabase
    .from('cm_dre_import_logs')
    .select('id, filename, started_at, finished_at, status, rows_imported')
    .order('started_at', { ascending: false })
    .limit(5);

  if (errDre) {
    console.error('Erro ao ler cm_dre_import_logs:', errDre.message);
  } else {
    console.log('\nLast 5 cm_dre_import_logs:');
    console.table(dreLogs);
  }

  // 3. Investment Import Jobs
  const { data: importJobs, error: errJobs } = await supabase
    .from('cm_import_jobs')
    .select('id, nome_arquivo, registros_count, investimento_total, status, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (errJobs) {
    console.error('Erro ao ler cm_import_jobs:', errJobs.message);
  } else {
    console.log('\nLast 3 cm_import_jobs:');
    console.table(importJobs);
  }

  // 4. Audit Logs (last 5)
  const { data: audits, error: errAudits } = await supabase
    .from('cm_audit_logs')
    .select('id, created_at, action, table_name')
    .order('created_at', { ascending: false })
    .limit(5);

  if (errAudits) {
    console.error('Erro ao ler cm_audit_logs:', errAudits.message);
  } else {
    console.log('\nLast 5 cm_audit_logs:');
    console.table(audits);
  }
}

run().catch(console.error);
