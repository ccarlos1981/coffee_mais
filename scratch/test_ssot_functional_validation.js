const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://ncncazbhpoxjlyvcbvqa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jbmNhemJocG94amx5dmNidnFhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTU5NzcyNywiZXhwIjoyMDkxMTczNzI3fQ.tl1yFASniZGdIWLwzvRz-yh_cT4qVg6JjvA9kyuhOsk'
);

async function testSSOTValidation() {
  console.log('=== VALIDAÇÃO DE PARIDADE E SINGLE SOURCE OF TRUTH (targets) ===\n');

  const year = 2026;
  const month = 7;

  // 1. Leitura direta na tabela oficial targets
  const { data: targets, error: targetErr } = await supabase
    .from('targets')
    .select('manager, target_revenue, target_tons')
    .eq('year', year)
    .eq('month', month);

  console.log('1. Conteúdo Oficial na tabela public.targets (Julho/2026):', targets);

  // 2. Leitura via API RPS (GET)
  const resRps = await fetch(`http://localhost:3000/api/processo-comercial/rps?year=${year}&month=${month}`).catch(() => null);
  
  // 3. Verificação de ausência total de DESAFIO_FAT e DESAFIO_VOL em cm_weekly_projections
  const { data: legacyProjs, error: projErr } = await supabase
    .from('cm_weekly_projections')
    .select('id, manager, kpi, projection_value')
    .eq('year', year)
    .eq('month', month)
    .in('kpi', ['DESAFIO_FAT', 'DESAFIO_VOL']);

  console.log('\n2. Verificação da proibição em cm_weekly_projections (deve ser 0):', legacyProjs ? legacyProjs.length : 0);
  if (legacyProjs && legacyProjs.length > 0) {
    console.error('ERRO: Foram encontrados registros de Desafio em cm_weekly_projections:', legacyProjs);
  } else {
    console.log('SUCESSO: Nenhuma duplicidade encontrada em cm_weekly_projections!');
  }
}

testSSOTValidation();
