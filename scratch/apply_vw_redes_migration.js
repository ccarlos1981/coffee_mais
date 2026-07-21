const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function applyMigration() {
  console.log('=== APLICANDO MIGRATION: vw_redes_planejaveis_oficiais ===\n');
  const sql = fs.readFileSync('/Users/cristiano/Projetos/Coffe Mais/supabase/migrations/20260721_create_vw_redes_planejaveis_oficiais.sql', 'utf8');

  const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });
  console.log('Resultado RPC:', { data, error });

  // Testar se a visão foi criada executando uma consulta nela
  const { data: testData, error: testErr } = await supabase.from('vw_redes_planejaveis_oficiais').select('*').limit(5);
  console.log('Erro de teste na visão:', testErr);
  console.log('Amostra de 5 linhas na nova visão:', testData);
}

applyMigration();
