require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('cod_parceiro, manager');
  const baseAtendimentoMap = new Map();
  for (const row of baseData) {
    if (row.cod_parceiro) baseAtendimentoMap.set(String(row.cod_parceiro), row);
  }
  const validPartnerCodes = Array.from(baseAtendimentoMap.keys());
  
  const DIGITAL_SELLERS = ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'];
  
  const [resA, resB] = await Promise.all([
    supabase.from('cm_faturamento_sankhya')
      .select('vlr_total_liq, cod_parceiro, nome_vendedor, nro_unico')
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .in('cod_parceiro', validPartnerCodes),
    supabase.from('cm_faturamento_sankhya')
      .select('vlr_total_liq, cod_parceiro, nome_vendedor, nro_unico')
      .gte('dt_faturamento', '2026-05-01')
      .lte('dt_faturamento', '2026-05-31')
      .in('nome_vendedor', DIGITAL_SELLERS)
  ]);
  
  const mergedMap = new Map();
  for (const r of (resA.data||[])) mergedMap.set(r.nro_unico, r);
  for (const r of (resB.data||[])) mergedMap.set(r.nro_unico, r);
  
  let totals = {};
  for (const row of Array.from(mergedMap.values())) {
    const vend = row.nome_vendedor || '';
    let m = null;
    if (vend === 'SHOPIFY' || vend === 'LIVELO') m = 'Ecommerce';
    else if (['AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU'].includes(vend)) m = 'Marketplace';
    else if (vend === 'AMAZON 1P') m = '1p';
    else {
      const baseRow = baseAtendimentoMap.get(String(row.cod_parceiro));
      if (baseRow && baseRow.manager) m = baseRow.manager;
    }
    
    if (m) {
      totals[m] = (totals[m] || 0) + (row.vlr_total_liq || 0);
    }
  }
  
  console.log("Managers:", totals);
  const totalGeral = Object.values(totals).reduce((a,b)=>a+b,0);
  console.log("Total:", totalGeral.toLocaleString('pt-BR'));
}
run();
