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

async function consolidateData() {
  const { data: rows, error } = await supabase.from('cm_weekly_projections').select('*');
  if (error) {
    console.error('Error fetching rows:', error);
    return;
  }
  console.log('Total de linhas em cm_weekly_projections antes da consolidação:', rows.length);

  const map = new Map();
  const idsToDelete = [];

  rows.forEach(r => {
    const canonicalName = resolveCanonicalManager(r.manager).managerName;
    const key = [canonicalName, r.client_matrix.trim().toUpperCase(), r.year, r.month, r.week_start_date, r.kpi].join('|');

    if (!map.has(key)) {
      map.set(key, { ...r, canonicalName });
    } else {
      const existing = map.get(key);
      // Manter o registro que possuir valor > 0 ou updated_at mais recente
      if (Number(r.projection_value) > 0 && Number(existing.projection_value) === 0) {
        idsToDelete.push(existing.id);
        map.set(key, { ...r, canonicalName });
      } else {
        idsToDelete.push(r.id);
      }
    }
  });

  console.log('Total de chaves canônicas únicas:', map.size);
  console.log('IDs a serem deletados (duplicados):', idsToDelete);

  // Deletar duplicados
  if (idsToDelete.length > 0) {
    const { error: delErr } = await supabase.from('cm_weekly_projections').delete().in('id', idsToDelete);
    console.log('Resultado da deleção dos duplicados:', delErr ? delErr.message : 'Sucesso');
  }

  // Atualizar o nome do manager nos registros que estavam com aliases históricos (ex: Leandro Saffi -> Leandro)
  let updatedCount = 0;
  for (const [key, item] of map.entries()) {
    if (item.manager !== item.canonicalName) {
      const { error: upErr } = await supabase
        .from('cm_weekly_projections')
        .update({ manager: item.canonicalName })
        .eq('id', item.id);
      if (!upErr) updatedCount++;
    }
  }

  console.log('Total de registros atualizados para o nome canônico:', updatedCount);

  const { data: finalRows } = await supabase.from('cm_weekly_projections').select('*');
  console.log('Total de linhas em cm_weekly_projections após consolidação:', finalRows.length);
}

consolidateData();
