const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function runDeepAudit() {
  console.log('=== AUDITORIA APROFUNDADA DE MODELAGEM ===\n');

  // 1. Listar todas as tabelas em public
  const { data: tablesData, error: tablesErr } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
  });
  console.log('Todas as tabelas public:', (tablesData || []).map(t => t.table_name));

  // 2. Colunas de base_atendimento
  const { data: colsBase } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'base_atendimento' ORDER BY ordinal_position;"
  });
  console.log('\nColunas de base_atendimento:', colsBase);

  // 3. Colunas de cm_clientes se existir
  const { data: colsClientes } = await supabase.rpc('execute_readonly_query', {
    query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cm_clientes' ORDER BY ordinal_position;"
  });
  console.log('\nColunas de cm_clientes:', colsClientes);

  // 4. Analisar distribuição de base_atendimento.rede
  const { data: redeStats } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COUNT(*) as total_registros_base,
        COUNT(DISTINCT rede) as total_redes_distintas,
        COUNT(DISTINCT nome_parceiro) as total_parceiros_distintos,
        COUNT(CASE WHEN rede IS NULL OR TRIM(rede) = '' THEN 1 END) as total_rede_vazia,
        COUNT(CASE WHEN TRIM(rede) ~ '^[0-9.]+$' THEN 1 END) as total_rede_apenas_numeros,
        COUNT(CASE WHEN UPPER(rede) = UPPER(nome_parceiro) THEN 1 END) as total_rede_igual_nome_parceiro,
        COUNT(CASE WHEN canal = 'Key Account' OR ka IS NOT NULL OR is_star = true THEN 1 END) as total_key_account_star
      FROM base_atendimento;
    `
  });
  console.log('\nEstatísticas de base_atendimento.rede:', redeStats);

  // 5. Exemplo de registros ADYEN, 911 EVENTOS, AMEDEO VIOLA, BAGACEIRA
  const { data: examples } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT cod_parceiro, nome_parceiro, rede, canal, manager, uf, ka, cnpj, status, cluster_canal, is_star
      FROM base_atendimento
      WHERE UPPER(rede) IN ('ADYEN LATIN AMERICA', '911 EVENTOS LTDA', 'AMEDEO VIOLA', 'BAGACEIRA')
         OR UPPER(nome_parceiro) IN ('ADYEN LATIN AMERICA', '911 EVENTOS LTDA', 'AMEDEO VIOLA', 'BAGACEIRA');
    `
  });
  console.log('\nExemplos investigados:', examples);

  // 6. Analisar os canais/clusters existentes em base_atendimento
  const { data: canalDist } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT canal, cluster_canal, COUNT(*) as qtd_registros, COUNT(DISTINCT rede) as qtd_redes_distintas
      FROM base_atendimento
      GROUP BY canal, cluster_canal
      ORDER BY COUNT(*) DESC;
    `
  });
  console.log('\nDistribuição de Canais em base_atendimento:', canalDist);

  // 7. Top 50 redes com contagem de parceiros e canal principal
  const { data: top50Redes } = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        rede,
        manager,
        canal,
        COUNT(DISTINCT cod_parceiro) as total_parceiros,
        COUNT(*) as total_linhas,
        SUM(faturamento_mensal) as fat_mensal
      FROM base_atendimento
      WHERE rede IS NOT NULL AND TRIM(rede) != ''
      GROUP BY rede, manager, canal
      ORDER BY COUNT(*) DESC
      LIMIT 50;
    `
  });
  console.log('\nTop 50 Redes em base_atendimento:', top50Redes);
}

runDeepAudit();
