const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function directAudit() {
  console.log('=== AUDITORIA DIRETA SUPABASE ===\n');

  // 1. Amostra de base_atendimento
  const { data: sampleBase, error: errBase } = await supabase.from('base_atendimento').select('*').limit(5);
  console.log('Err Base:', errBase);
  if (sampleBase && sampleBase.length > 0) {
    console.log('Colunas de base_atendimento:', Object.keys(sampleBase[0]));
    console.log('Exemplo 1 base_atendimento:', sampleBase[0]);
  }

  // 2. Amostra de cm_clientes
  const { data: sampleClientes, error: errClientes } = await supabase.from('cm_clientes').select('*').limit(5);
  console.log('\nErr Clientes:', errClientes);
  if (sampleClientes && sampleClientes.length > 0) {
    console.log('Colunas de cm_clientes:', Object.keys(sampleClientes[0]));
    console.log('Exemplo 1 cm_clientes:', sampleClientes[0]);
  }

  // 3. Investigar ADYEN LATIN AMERICA, 911 EVENTOS, AMEDEO VIOLA, BAGACEIRA em base_atendimento
  const { data: exBase } = await supabase
    .from('base_atendimento')
    .select('*')
    .or('rede.ilike.%ADYEN%,rede.ilike.%911 EVENTOS%,rede.ilike.%AMEDEO VIOLA%,rede.ilike.%BAGACEIRA%,nome_parceiro.ilike.%ADYEN%,nome_parceiro.ilike.%911 EVENTOS%,nome_parceiro.ilike.%AMEDEO VIOLA%,nome_parceiro.ilike.%BAGACEIRA%');
  console.log('\nExemplos em base_atendimento:', exBase);

  // 4. Investigar os mesmos em cm_clientes se existir
  if (!errClientes) {
    const { data: exClientes } = await supabase
      .from('cm_clientes')
      .select('*')
      .or('nome_fantasia.ilike.%ADYEN%,nome_fantasia.ilike.%911 EVENTOS%,razao_social.ilike.%ADYEN%,razao_social.ilike.%911 EVENTOS%');
    console.log('\nExemplos em cm_clientes:', exClientes);
  }

  // 5. Contar estatísticas de base_atendimento
  const { count: totalBase } = await supabase.from('base_atendimento').select('*', { count: 'exact', head: true });
  console.log('\nTotal de linhas em base_atendimento:', totalBase);

  // 6. Buscar todas as linhas de base_atendimento (paginado se necessário) para analisar estatísticas
  const { data: allBase } = await supabase.from('base_atendimento').select('cod_parceiro, nome_parceiro, rede, canal, manager, ka, is_star, cluster_canal');
  console.log('Total de linhas retornadas:', allBase ? allBase.length : 0);

  if (allBase) {
    const redeSet = new Set();
    let countEmptyRede = 0;
    let countRedeEqualNomeParceiro = 0;
    let countNumericRede = 0;
    let countRazaoSocial = 0;

    const redeFrequency = {};

    allBase.forEach(row => {
      const r = row.rede ? row.rede.trim() : '';
      const np = row.nome_parceiro ? row.nome_parceiro.trim() : '';

      if (!r) {
        countEmptyRede++;
      } else {
        redeSet.add(r);
        redeFrequency[r] = (redeFrequency[r] || 0) + 1;

        if (r.toUpperCase() === np.toUpperCase()) {
          countRedeEqualNomeParceiro++;
        }
        if (/^\d+$/.test(r.replace(/[\/\.\-]/g, ''))) {
          countNumericRede++;
        }
        if (/LTDA|S\.A|S\/A|EIRELI|ME\b/i.test(r)) {
          countRazaoSocial++;
        }
      }
    });

    console.log(`\nESTATÍSTICAS DA COLUNA base_atendimento.rede:`);
    console.log(`- Total de registros: ${allBase.length}`);
    console.log(`- Total de valores de rede distintos: ${redeSet.size}`);
    console.log(`- Registros com rede vazia/nula: ${countEmptyRede}`);
    console.log(`- Registros onde rede == nome_parceiro: ${countRedeEqualNomeParceiro}`);
    console.log(`- Registros onde rede é numérico/CNPJ/CPF: ${countNumericRede}`);
    console.log(`- Registros onde rede tem formato de Razão Social (LTDA, S.A, EIRELI, ME): ${countRazaoSocial}`);

    // Top 50 mais frequentes
    const sortedRedes = Object.entries(redeFrequency).sort((a, b) => b[1] - a[1]);
    console.log('\nTOP 50 VALORES MAIS FREQUENTES EM base_atendimento.rede:');
    sortedRedes.slice(0, 50).forEach(([rName, freq], idx) => {
      console.log(`${idx + 1}. ${rName} (${freq} PDVs)`);
    });
  }
}

directAudit();
