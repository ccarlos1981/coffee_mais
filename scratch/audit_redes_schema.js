const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function runAuditQueries() {
  console.log('=== AUDITORIA DE MODELAGEM: REDES COMERCIAIS ===\n');

  // 1. Verificar tabelas do sistema que possam conter cadastro mestre de redes
  const sqlTables = `
    SELECT table_name 
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%rede%' OR table_name LIKE '%cliente%' OR table_name LIKE '%matriz%' OR table_name LIKE '%base%' OR table_name LIKE '%master%' OR table_name LIKE '%cm_%');
  `;
  const resTables = await supabase.rpc('execute_readonly_query', { query_text: "SELECT table_name FROM information_schema.tables WHERE table_schema IN ('public', 'base_atendimento') AND (table_name LIKE '%rede%' OR table_name LIKE '%cliente%' OR table_name LIKE '%matriz%' OR table_name LIKE '%base%' OR table_name LIKE '%master%' OR table_name LIKE '%cm_%');" });
  console.log('Tabelas encontradas no schema:', resTables.data);

  // 2. Inspecionar colunas de base_atendimento
  const resColsBase = await supabase.rpc('execute_readonly_query', { query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'base_atendimento';" });
  console.log('\nColunas de base_atendimento:', resColsBase.data);

  // 3. Inspecionar colunas de cm_clientes ou cm_redes se existirem
  const resColsClientes = await supabase.rpc('execute_readonly_query', { query_text: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cm_clientes';" });
  console.log('\nColunas de cm_clientes:', resColsClientes.data);

  // 4. Analisar a distribuição do campo base_atendimento.rede
  const resRedeDist = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        COUNT(*) as total_linhas,
        COUNT(DISTINCT rede) as total_redes_distintas,
        COUNT(CASE WHEN rede IS NULL OR TRIM(rede) = '' THEN 1 END) as total_vazias,
        COUNT(CASE WHEN TRIM(rede) ~ '^[0-9.]+$' THEN 1 END) as total_apenas_cnpj_cpf,
        COUNT(CASE WHEN UPPER(rede) LIKE '% LTDA%' OR UPPER(rede) LIKE '% S.A%' OR UPPER(rede) LIKE '% S/A%' OR UPPER(rede) LIKE '% ME%' OR UPPER(rede) LIKE '% EIRELI%' THEN 1 END) as total_razao_social
      FROM base_atendimento;
    `
  });
  console.log('\nEstatísticas da coluna base_atendimento.rede:', resRedeDist.data);

  // 5. Top 50 valores mais frequentes em base_atendimento.rede
  const resTop50 = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT 
        rede, 
        manager,
        canal,
        ka,
        COUNT(*) as total_pdvs,
        SUM(faturamento_mensal) as fat_mensal
      FROM base_atendimento
      WHERE rede IS NOT NULL AND TRIM(rede) != ''
      GROUP BY rede, manager, canal, ka
      ORDER BY COUNT(*) DESC
      LIMIT 50;
    `
  });
  console.log('\nTop 50 redes em base_atendimento (por contagem de PDVs):', resTop50.data);

  // 6. Investigar por que 'ADYEN LATIN AMERICA', '911 EVENTOS LTDA', 'AMEDEO VIOLA', 'BAGACEIRA' estão em base_atendimento.rede
  const resExamples = await supabase.rpc('execute_readonly_query', {
    query_text: `
      SELECT cod_parceiro, nome_parceiro, rede, canal, manager, uf, ka, cnpj, status, razao_social, nome_fantasia
      FROM base_atendimento
      WHERE UPPER(rede) IN ('ADYEN LATIN AMERICA', '911 EVENTOS LTDA', 'AMEDEO VIOLA', 'BAGACEIRA')
         OR UPPER(nome_parceiro) IN ('ADYEN LATIN AMERICA', '911 EVENTOS LTDA', 'AMEDEO VIOLA', 'BAGACEIRA');
    `
  });
  console.log('\nExemplos investigados em base_atendimento:', resExamples.data);
}

runAuditQueries();
