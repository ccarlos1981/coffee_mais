require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('*');
  const baseAtendimentoMap = new Map();
  for (const row of baseData) if(row.cod_parceiro) baseAtendimentoMap.set(String(row.cod_parceiro), row);
  
  let from = 0;
  let all = [];
  while(true) {
    const { data, error } = await supabase.from('cm_faturamento_sankhya')
      .select('cod_parceiro')
      .in('nome_vendedor', ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'])
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  
  let overlaps = 0;
  for (const r of all) {
    if (baseAtendimentoMap.has(String(r.cod_parceiro))) overlaps++;
  }
  console.log(`Overlaps: ${overlaps} out of ${all.length}`);
}
run();
