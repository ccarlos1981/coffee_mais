const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function inspectCmClientes() {
  console.log('=== INVESTIGAÇÃO DE cm_clientes E OUTRAS ESTRUTURAS ===\n');

  // 1. Amostra de cm_clientes onde matriz ou codigo_matriz não são nulos
  const { data: matrizes, error: errMat } = await supabase
    .from('cm_clientes')
    .select('id, codigo, nome_parceiro, razao_social, matriz, codigo_matriz, ka, responsavel, manager_name')
    .not('matriz', 'is', null)
    .limit(20);
  
  console.log('Amostra de clientes em cm_clientes com matriz preenchida:', matrizes);

  // 2. Total de clientes em cm_clientes com matriz vs total de clientes
  const { count: totalClientes } = await supabase.from('cm_clientes').select('*', { count: 'exact', head: true });
  const { count: totalComMatriz } = await supabase.from('cm_clientes').select('*', { count: 'exact', head: true }).not('matriz', 'is', null);

  console.log(`\ncm_clientes: Total = ${totalClientes}, Com Matriz = ${totalComMatriz}`);

  // 3. Investigar se existe a RPC ou view official de redes usada pela Governança ou Dashboard
  const { data: viewsData } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT table_name FROM information_schema.views WHERE table_schema = 'public';"
  });
  console.log('\nViews public no banco:', (viewsData || []).map(v => v.table_name));

  // 4. Analisar detalhadamente base_atendimento para entender como Atendimento, Comercial e Sankhya identificam uma Rede
  const { data: kaStats } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        canal,
        ka,
        is_star,
        COUNT(*) as total_pdvs,
        COUNT(DISTINCT rede) as redes_distintas
      FROM base_atendimento
      WHERE manager IS NOT NULL
      GROUP BY canal, ka, is_star
      ORDER BY total_pdvs DESC;
    `
  });
  console.log('\nBreakdown de Gerentes em base_atendimento por Canal, KA e Is_Star:', kaStats.data);
}

inspectCmClientes();
