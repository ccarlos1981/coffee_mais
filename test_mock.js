require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: baseData } = await supabase.from('base_atendimento').select('*');
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
        .select('dt_faturamento, cod_parceiro, nome_parceiro, desc_produto, quantidade, vlr_total_liq, custo_icms, custo_total, vlr_frete, vlr_total_st, nro_unico, nome_vendedor');
      
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
  const deduplicatedData = Array.from(new Map(data.map(r => [r.nro_unico, r])).values());
  
  let all = [];
  
  for (const row of deduplicatedData) {
      const vend = row.nome_vendedor || '';
      let pseudoManager = null;
      let pseudoCanal = null;

      if (vend === 'SHOPIFY' || vend === 'LIVELO') {
        pseudoManager = 'Ecommerce';
        pseudoCanal = 'Ecommerce';
      } else if (['AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU'].includes(vend)) {
        pseudoManager = 'Marketplace';
        pseudoCanal = 'Marketplace';
      } else if (vend === 'AMAZON 1P') {
        pseudoManager = '1p';
        pseudoCanal = '1p';
      }

      let managerToUse = null;

      if (pseudoManager) {
        managerToUse = pseudoManager;
      } else {
        const baseRow = baseAtendimentoMap.get(String(row.cod_parceiro));
        if (!baseRow || !baseRow.manager) continue;
        managerToUse = baseRow.manager;
      }

      all.push({
        manager: managerToUse,
        net_value: row.vlr_total_liq
      });
  }
  
  let byManagerMap = {};
  for(let sale of all) {
    if (!byManagerMap[sale.manager]) byManagerMap[sale.manager] = 0;
    byManagerMap[sale.manager] += (parseFloat(sale.net_value) || 0);
  }
  
  console.log(byManagerMap);
}
run();
