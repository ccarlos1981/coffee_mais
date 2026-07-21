const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function inspectChannelsAndTables() {
  console.log('=== INVESTIGAÇÃO DE CANAIS E TABELAS MESTRE ===\n');

  // 1. Paginar base_atendimento para pegar todos os 2341 registros
  let allRecords = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from('base_atendimento').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    allRecords = allRecords.concat(data);
    if (data.length < step) break;
    from += step;
  }
  console.log(`Total de registros lidos de base_atendimento: ${allRecords.length}`);

  // 2. Agrupar por canal e verificar quantas redes distintas e se nome_parceiro == rede
  const canalStats = {};
  allRecords.forEach(r => {
    const c = r.canal || 'SEM CANAL';
    if (!canalStats[c]) {
      canalStats[c] = {
        total: 0,
        redes: new Set(),
        equalNameCount: 0,
        examplesEqual: []
      };
    }
    canalStats[c].total++;
    if (r.rede) {
      canalStats[c].redes.add(r.rede.trim());
      if (r.rede.trim().toUpperCase() === (r.nome_parceiro || '').trim().toUpperCase()) {
        canalStats[c].equalNameCount++;
        if (canalStats[c].examplesEqual.length < 5) {
          canalStats[c].examplesEqual.push(r.rede.trim());
        }
      }
    }
  });

  console.log('\n--- ANÁLISE DE CANAIS EM base_atendimento ---');
  Object.keys(canalStats).forEach(c => {
    const st = canalStats[c];
    console.log(`\nCanal: "${c}"`);
    console.log(`  - Total PDVs/Clientes: ${st.total}`);
    console.log(`  - Redes distintas: ${st.redes.size}`);
    console.log(`  - Quantidade onde rede == nome_parceiro: ${st.equalNameCount}`);
    console.log(`  - Exemplos onde rede == nome_parceiro: ${st.examplesEqual.join(', ')}`);
  });

  // 3. Investigar se existe tabela mestre de redes
  const { data: governRedes, error: errGov } = await supabase.from('cm_governance_master_redes').select('*').limit(20);
  console.log('\n--- Tabela cm_governance_master_redes ---');
  console.log('Err:', errGov ? errGov.message : 'null');
  if (governRedes) console.log('Amostra cm_governance_master_redes:', governRedes);

  // 4. Investigar cm_acoes_investimento
  const { data: invRedes, error: errInv } = await supabase.from('cm_acoes_investimento').select('rede, empresa').limit(20);
  console.log('\n--- Tabela cm_acoes_investimento (Redes com investimentos Trade) ---');
  if (invRedes) {
    const setInv = new Set(invRedes.map(i => i.rede));
    console.log('Total redes distintas em cm_acoes_investimento:', setInv.size);
    console.log('Amostra redes cm_acoes_investimento:', Array.from(setInv).slice(0, 15));
  }

  // 5. Investigar se existe tabela cm_matrizes
  const { data: matrizes, error: errMat } = await supabase.from('cm_matrizes').select('*').limit(20);
  console.log('\n--- Tabela cm_matrizes ---');
  console.log('Err:', errMat ? errMat.message : 'null');
  if (matrizes) console.log('Amostra cm_matrizes:', matrizes);
}

inspectChannelsAndTables();
