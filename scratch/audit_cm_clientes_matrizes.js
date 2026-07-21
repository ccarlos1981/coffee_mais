const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

function canonicalizeKey(value) {
  if (!value) return '';
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function resolveCanonicalManager(identifier) {
  if (!identifier) return { managerId: '9999', managerName: 'Outros', canonicalKey: 'OUTROS' };
  const rawKey = canonicalizeKey(identifier);
  if (rawKey === 'LEANDRO' || rawKey === 'LEANDRO SAFFI' || rawKey === '1001') {
    return { managerId: '1001', managerName: 'Leandro', canonicalKey: 'LEANDRO' };
  }
  if (rawKey === 'JULLIANO' || rawKey === '1000') {
    return { managerId: '1000', managerName: 'Julliano', canonicalKey: 'JULLIANO' };
  }
  if (rawKey === 'LUIZ' || rawKey === '1002') {
    return { managerId: '1002', managerName: 'Luiz', canonicalKey: 'LUIZ' };
  }
  return { managerId: '9999', managerName: identifier.trim(), canonicalKey: rawKey };
}

function isSameManager(a, b) {
  return resolveCanonicalManager(a).canonicalKey === resolveCanonicalManager(b).canonicalKey;
}

async function auditCmClientesMatrizes() {
  console.log('=== INVESTIGAÇÃO DE MATRIZES / REDES EM cm_clientes E base_atendimento ===\n');

  // 1. Ler todas as linhas de cm_clientes
  let allClientes = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase.from('cm_clientes').select('*').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    allClientes = allClientes.concat(data);
    if (data.length < step) break;
    from += step;
  }

  console.log(`Total de clientes em cm_clientes: ${allClientes.length}`);

  const managers = ['Julliano', 'Leandro', 'Luiz'];

  managers.forEach(mName => {
    const mgrClientes = allClientes.filter(c => isSameManager(c.responsavel || c.manager_name, mName));
    
    // Matrizes preenchidas em cm_clientes
    const matrizesSet = new Set();
    mgrClientes.forEach(c => {
      if (c.matriz && c.matriz.trim()) {
        matrizesSet.add(c.matriz.trim());
      }
    });

    const listMatrizes = Array.from(matrizesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    console.log(`\n--------------------------------------------------`);
    console.log(`GERENTE: ${mName}`);
    console.log(`Total Clientes no Cadastro Único: ${mgrClientes.length}`);
    console.log(`Total MATRIZES / REDES COMERCIAIS em cm_clientes: ${listMatrizes.length}`);
    console.log(`--------------------------------------------------`);
    console.log(listMatrizes);
  });
}

auditCmClientesMatrizes();
