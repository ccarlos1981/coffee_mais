require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('*');
  const baseMap = {};
  for(let row of baseData) {
    baseMap[row.cod_parceiro] = row;
  }
  
  let from = 0;
  let stats = {
    total: 0,
    ecommerce: 0,
    marketplace: 0,
    inside_sales: 0,
    key_account: 0,
    one_p: 0,
    private_label: 0,
    other: 0
  };
  
  while (true) {
    const { data, error } = await supabase
      .from('cm_faturamento_sankhya')
      .select('cod_parceiro, nome_vendedor, vlr_total_liq, status_nfe')
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .range(from, from + 999);
      
    if (error || !data || data.length === 0) break;
    
    for (const row of data) {
      if (row.status_nfe === 'Cancelada' || row.status_nfe === 'Denegada' || row.status_nfe === 'Devolução') continue; // assuming
      
      const v = row.vlr_total_liq || 0;
      stats.total += v;
      
      const base = baseMap[row.cod_parceiro];
      const manager = base ? base.manager : null;
      const canal = base ? base.canal : null;
      const vend = row.nome_vendedor || '';
      
      if (vend === 'SHOPIFY' || vend === 'LIVELO') {
        stats.ecommerce += v;
      } else if (['AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU'].includes(vend)) {
        stats.marketplace += v;
      } else if (vend === 'AMAZON 1P') {
        stats.one_p += v;
      } else if (manager && ['Luiz', 'Julliano', 'Leandro'].includes(manager)) {
        stats.key_account += v;
      } else if (manager === 'Inside Sales' || vend === 'LUISA' || vend === 'FERNANDA') {
        // The image has 485k for Inside Sales. 
        stats.inside_sales += v;
      } else if (canal === 'Marca Própria' || vend.includes('PRIVATE')) {
        stats.private_label += v;
      } else {
        stats.other += v;
      }
    }
    from += 1000;
  }
  
  console.log("Stats for May 2026:");
  console.log(stats);
}
run();
