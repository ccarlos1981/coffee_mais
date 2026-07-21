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

async function testCleanRedes() {
  const curMonthKey = '2026-07';
  const prevMonthKey = '2026-06';
  const prevYearKey = '2025-07';
  const closedMonth2 = '2026-05';
  const closedMonth3 = '2026-04';

  const sqlClientHistory = `
    SELECT 
      mes,
      manager,
      TRIM(rede) as client,
      SUM(fat) as fat
    FROM mv_vendas_cliente_mensal
    WHERE mes IN ('${curMonthKey}', '${prevMonthKey}', '${prevYearKey}', '${closedMonth2}', '${closedMonth3}')
      AND rede IS NOT NULL AND TRIM(rede) != ''
    GROUP BY mes, manager, TRIM(rede)
  `;

  const sqlBaseClients = `
    SELECT 
      manager,
      TRIM(rede) as client
    FROM base_atendimento
    WHERE manager IS NOT NULL AND rede IS NOT NULL AND TRIM(rede) != ''
    GROUP BY manager, TRIM(rede)
  `;

  const [resCliHist, resBaseCli] = await Promise.all([
    supabase.rpc('execute_readonly_query', { query_text: sqlClientHistory }),
    supabase.rpc('execute_readonly_query', { query_text: sqlBaseClients })
  ]);

  const cliHist = resCliHist.data || [];
  const baseCli = resBaseCli.data || [];

  const managers = ['Julliano', 'Leandro', 'Luiz'];

  managers.forEach(mName => {
    const managerCliHist = cliHist.filter((c) => isSameManager(c.manager, mName));
    const managerBaseCli = baseCli.filter((b) => isSameManager(b.manager, mName));

    const set = new Set([
      ...managerCliHist.map((c) => c.client),
      ...managerBaseCli.map((b) => b.client)
    ]);

    set.delete('');
    set.delete('Não Mapeado');
    set.delete('OUTROS');

    // Filtrar CNPJs puros
    const cleanRedes = Array.from(set).filter(r => !/^\d+/.test(r));
    cleanRedes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    cleanRedes.push('OUTROS');

    console.log(`\n==================================================`);
    console.log(`GERENTE: ${mName} -> TOTAL REDES COMERCIAIS: ${cleanRedes.length - 1} (+ OUTROS)`);
    console.log(`==================================================`);
    console.log(cleanRedes);
  });
}

testCleanRedes();
