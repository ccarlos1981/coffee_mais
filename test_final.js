require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  let baseData = [];
  let fromBase = 0;
  while(true) {
      const { data } = await supabase.from('base_atendimento').select('*').range(fromBase, fromBase + 999);
      if (!data || data.length === 0) break;
      baseData.push(...data);
      if (data.length < 1000) break;
      fromBase += 1000;
  }
  
  const baseAtendimentoMap = new Map();
  for (const row of baseData) if(row.cod_parceiro) baseAtendimentoMap.set(String(row.cod_parceiro), row);
  const validPartnerCodes = Array.from(baseAtendimentoMap.keys());
  
  const CHUNK_SIZE = 200;
  const chunks = [];
  for (let i = 0; i < validPartnerCodes.length; i += CHUNK_SIZE) {
    chunks.push(validPartnerCodes.slice(i, i + CHUNK_SIZE));
  }
  
  const DIGITAL_SELLERS = ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'];
  
  const fetchChunk = async (chunk, isDigital = false) => {
    let from = 0;
    const chunkData = [];
    while (true) {
      let query = supabase.from('cm_faturamento_sankhya')
        .select('id, dt_faturamento, cod_parceiro, nome_parceiro, desc_produto, quantidade, vlr_total_liq, custo_icms, custo_total, vlr_frete, vlr_total_st, nro_unico, nome_vendedor, cod_natureza, cod_top');
      
      if (isDigital) {
        query = query.in('nome_vendedor', DIGITAL_SELLERS);
      } else {
        query = query.in('cod_parceiro', chunk);
      }
      query = query.gte('dt_faturamento', '2026-05-01').lte('dt_faturamento', '2026-05-31');
      
      const { data, error } = await query.range(from, from + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      chunkData.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    return chunkData;
  };
  
  const promises = chunks.map(chunk => fetchChunk(chunk, false));
  promises.push(fetchChunk([], true)); // Digital channels
  
  const results = await Promise.all(promises);
  const data = results.flat();
  const deduplicatedData = Array.from(new Map(data.map(r => [r.id, r])).values());
  
  let sums = {};
  for(let row of deduplicatedData) {
      const vend = row.nome_vendedor || '';
      let m = null;

      if (vend === 'SHOPIFY' || vend === 'LIVELO') {
        m = 'Ecommerce';
      } else if (['AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'].includes(vend)) {
        m = 'Marketplace';
      }

      if (!m) {
        const baseRow = baseAtendimentoMap.get(String(row.cod_parceiro));
        if (!baseRow || !baseRow.manager) continue;
        m = baseRow.manager;
      }
      
      if (m === 'Ecommerce' || m === 'Marketplace' || m === '1p') {
          if (Number(row.cod_top) !== 1100) continue;
      } else {
          if (![3, 222, 9, 313, 219, 216].includes(Number(row.cod_natureza))) continue;
          if (![301, 303, 309, 311, 314].includes(Number(row.cod_top))) continue;
      }

      sums[m] = (sums[m] || 0) + (row.vlr_total_liq || 0);
  }
  
  let total = 0;
  for(let [k,v] of Object.entries(sums)) {
      console.log(`${k}: ${v.toFixed(2)}`);
      total += v;
  }
  console.log(`TOTAL: ${total.toFixed(2)}`);
}
run();
