const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

function canonicalizeKey(value) {
  if (!value) return "";
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function resolveCanonicalManager(identifier) {
  if (!identifier) return { managerId: "9999", managerName: "Outros", canonicalKey: "OUTROS" };
  const rawKey = canonicalizeKey(identifier);
  if (rawKey === "LEANDRO" || rawKey === "LEANDRO SAFFI" || rawKey === "1001") {
    return { managerId: "1001", managerName: "Leandro", canonicalKey: "LEANDRO" };
  }
  return { managerId: "9999", managerName: identifier.trim(), canonicalKey: rawKey };
}

function isSameManager(a, b) {
  return resolveCanonicalManager(a).canonicalKey === resolveCanonicalManager(b).canonicalKey;
}

async function runForensicAudit() {
  console.log('=== AUDITORIA FORENSE — PROJEÇÕES SEMANAIS (RPS) ===\n');

  const year = 2026;
  const month = 7;
  const mondays = ['2026-07-06', '2026-07-13', '2026-07-20', '2026-07-27'];
  const targetWeekIndex = 2; // 20/07
  const targetWeekDate = mondays[targetWeekIndex]; // '2026-07-20'
  const valTyped = 3500; // Digitado 3500 (em milhares)
  const rawValueStoredInState = valTyped * 1000; // 3500000

  // 1. INPUT REACT
  console.log('--- STEP 1. Input React ---');
  let managersState = [
    {
      manager: 'Leandro',
      kpis: {
        VOL: { ano_a: 54366, mes_a: 103528, desafio: 110000, projections: [0, 0, 0, 0] },
        FAT: { ano_a: 1472000, mes_a: 3076000, desafio: 3427000, projections: [0, 0, 0, 0] },
        INVEST: { ano_a: 0, mes_a: 0, desafio: 10, projections: [0, 0, 0, 0] }
      },
      clients: []
    }
  ];

  // Simula handleManagerKpiChange(0, 'FAT', 2, 3500 * 1000)
  managersState[0].kpis.FAT.projections[2] = rawValueStoredInState;
  console.log('Estado React após alteração da semana 20/07:', {
    manager: managersState[0].manager,
    kpi: 'FAT',
    weekIndex: targetWeekIndex,
    weekDate: targetWeekDate,
    projection: managersState[0].kpis.FAT.projections[2]
  });

  // 2. ESTADO IMEDIATAMENTE ANTES DO SAVE
  console.log('\n--- STEP 2. Estado antes do Save ---');
  console.log('managers[0].kpis.FAT.projections:', managersState[0].kpis.FAT.projections);

  // 3. CONSTRUÇÃO DO PAYLOAD
  console.log('\n--- STEP 3. Construção do Payload ---');
  const payloadProjs = [];
  managersState.forEach(mgr => {
    mgr.kpis.FAT.projections.forEach((val, idx) => {
      payloadProjs.push({
        manager: mgr.manager,
        client_matrix: '_TOTAL_',
        week_start_date: mondays[idx],
        kpi: 'FAT',
        projection_value: val
      });
    });
  });
  const targetPayloadItem = payloadProjs.find(p => p.manager === 'Leandro' && p.client_matrix === '_TOTAL_' && p.week_start_date === '2026-07-20' && p.kpi === 'FAT');
  console.log('Item do payload para 20/07:', targetPayloadItem);

  // 4. POST
  console.log('\n--- STEP 4. POST (request.json) ---');
  console.log('Payload recebido pela API POST:', targetPayloadItem);

  // 5. ROWS TO UPSERT
  console.log('\n--- STEP 5. rowsToUpsert ---');
  const rowsToUpsert = payloadProjs.map(p => ({
    manager: resolveCanonicalManager(p.manager).managerName,
    client_matrix: p.client_matrix,
    year,
    month,
    week_start_date: p.week_start_date,
    kpi: p.kpi,
    projection_value: Number(p.projection_value),
    updated_at: new Date().toISOString()
  }));
  const targetRowToUpsert = rowsToUpsert.find(r => r.manager === 'Leandro' && r.client_matrix === '_TOTAL_' && r.week_start_date === '2026-07-20' && r.kpi === 'FAT');
  console.log('Objeto rowsToUpsert:', targetRowToUpsert);

  // 6. UPSERT
  console.log('\n--- STEP 6. UPSERT execution ---');
  console.log('onConflict:', 'manager,client_matrix,year,month,week_start_date,kpi');
  const { error: upsertErr } = await supabase
    .from('cm_weekly_projections')
    .upsert(rowsToUpsert, { onConflict: 'manager,client_matrix,year,month,week_start_date,kpi' });
  console.log('Resultado do Upsert error:', upsertErr);

  // 7. BANCO DE DADOS
  console.log('\n--- STEP 7. Leitura Física do Banco de Dados ---');
  const sqlSelect = "SELECT * FROM cm_weekly_projections WHERE manager='Leandro' AND kpi='FAT' ORDER BY week_start_date;";
  const { data: dbRows, error: selectErr } = await supabase.rpc('execute_readonly_query', { query_text: sqlSelect });
  console.log('Linhas retornadas pelo banco:', dbRows);

  // 8. GET HANDLER QUERY
  console.log('\n--- STEP 8 & 9. GET Handler & Montagem de projections[] ---');
  const sqlWeeklyProjections = "SELECT manager, client_matrix, week_start_date::text as week_start_date, kpi, projection_value FROM cm_weekly_projections WHERE year = 2026 AND month = 7";
  const resProj = await supabase.rpc('execute_readonly_query', { query_text: sqlWeeklyProjections });
  const dbProjections = resProj.data || [];

  const mName = 'Leandro';
  const managerProjs = dbProjections.filter((p) => isSameManager(p.manager, mName) && p.client_matrix === '_TOTAL_');
  console.log('dbProjections filtradas para Leandro + _TOTAL_:', managerProjs);

  const projectionsMounted = mondays.map(date => {
    const p = managerProjs.find((p) => p.week_start_date === date && p.kpi === 'FAT');
    if (p) return Number(p.projection_value);
    return 0;
  });

  console.log('projections[] montado no GET:', projectionsMounted);
  console.log('Mapeamento por semana:');
  mondays.forEach((mDate, idx) => {
    const matchedRecord = managerProjs.find(p => p.week_start_date === mDate && p.kpi === 'FAT');
    console.log(`- ${mDate} (posição ${idx}):`, matchedRecord ? matchedRecord.projection_value : '0 (não encontrado)');
  });

  // 10. FRONTEND INDEXING
  console.log('\n--- STEP 10. Frontend Input Indexing & Rendering ---');
  mondays.forEach((mDate, wIdx) => {
    const val = projectionsMounted[wIdx];
    const inputValue = val === 0 ? '' : Math.round(val / 1000).toString();
    console.log(`- Coluna ${mDate} (wIdx=${wIdx}): val=${val}, inputValue="${inputValue}"`);
  });
}

runForensicAudit();
