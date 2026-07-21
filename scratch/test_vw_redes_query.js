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

async function testViewQuery() {
  console.log('=== TESTANDO VISÃO VW_REDES_PLANEJAVEIS_OFICIAIS ===\n');
  const { data, error } = await supabase
    .from('vw_redes_planejaveis_oficiais')
    .select('*')
    .eq('is_rede_planejavel', true);

  console.log('Erro de consulta:', error);
  console.log(`Total de Redes Planejáveis Oficiais na visão: ${data ? data.length : 0}`);

  const managers = ['Julliano', 'Leandro', 'Luiz'];

  managers.forEach(mName => {
    const list = (data || []).filter(r => isSameManager(r.manager, mName) || isSameManager(r.manager_id, mName)).map(r => r.rede.trim());
    const set = new Set(list);
    const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    sorted.push('OUTROS');

    console.log(`\n--------------------------------------------------`);
    console.log(`GERENTE: ${mName} -> REDES PLANEJÁVEIS OFICIAIS: ${sorted.length - 1} (+ OUTROS)`);
    console.log(`--------------------------------------------------`);
    console.log(sorted);
  });
}

testViewQuery();
