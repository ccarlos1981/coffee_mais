require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getBaseAtendimentoMap() {
  const map = new Map();
  let from = 0;
  const batchSize = 1000;
  while(true) {
    const { data, error } = await supabase.from('base_atendimento').select('*').range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (row.cod_parceiro) {
        map.set(String(row.cod_parceiro), row);
      }
    }
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return map;
}

async function fetchAllSales(startDate, endDate) {
  const baseMap = await getBaseAtendimentoMap();
  const all = [];
  const batchSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('cm_faturamento_sankhya')
      .select('dt_faturamento, cod_parceiro, nome_parceiro, desc_produto, quantidade, vlr_total_liq, custo_icms, custo_total, vlr_frete, vlr_total_st')
      .gte('dt_faturamento', startDate)
      .lte('dt_faturamento', endDate);

    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      const baseRow = baseMap.get(String(row.cod_parceiro));
      if (!baseRow || !baseRow.manager) continue;

      let familia = 'Outros';
      const p = (row.desc_produto || '').toString().toUpperCase();
      if (p.includes('1KG')) familia = '1 KG';
      else if (p.includes('5KG') || p.includes('5 KG')) familia = '5 KG';
      else if (p.includes('CAPSULA') || p.includes('CÁPSULA')) familia = 'Cápsula';
      else if (p.includes('DRIP')) familia = 'Drip';
      else if (p.includes('GEISHA')) familia = 'Geisha';
      else if (p.includes('VERDE')) familia = 'Café Verde';
      else if (p.includes('GRAO') || p.includes('GRÃO')) familia = 'Grão';
      else if (p.includes('MOIDO') || p.includes('MOÍDO')) familia = 'Moído';
      else if (p.includes('ACESSORIO') || p.includes('GARRAFA') || p.includes('CANECA') || p.includes('KIT')) familia = 'Acessório';

      all.push({
        manager: baseRow.manager,
        rede: baseRow.rede,
        nome_parceiro: row.nome_parceiro,
        tipo_produto: familia,
        product: row.desc_produto,
        invoice_date: row.dt_faturamento,
        net_value: row.vlr_total_liq,
        quantity: row.quantidade,
        imposto: (row.custo_icms || 0) + (row.vlr_total_st || 0),
        custo_total: row.custo_total,
        custo_frete: row.vlr_frete,
        receita_frete: 0
      });
    }

    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

function aggregate(sales, investmentPct) {
  const byManagerMap = {};
  const byFamiliaMap = {};
  let totalFat = 0, totalQty = 0, totalMaco = 0;

  for (const sale of sales) {
    const m = sale.manager || 'Outros';
    const familia = sale.tipo_produto || 'Outros';
    const client = sale.rede || sale.nome_parceiro || 'Não Mapeado';

    const vlr = parseFloat(sale.net_value) || 0;
    const qty = parseFloat(sale.quantity) || 0;
    const imposto = parseFloat(sale.imposto) || 0;
    const custoTotal = parseFloat(sale.custo_total) || 0;
    const custoFrete = parseFloat(sale.custo_frete) || 0;
    const investimentos = vlr * investmentPct;
    const maco = vlr - imposto - custoTotal - custoFrete - investimentos;

    totalFat += vlr;
    totalQty += qty;
    totalMaco += maco;

    if (!byManagerMap[m]) {
      byManagerMap[m] = { fat: 0, qty: 0, maco: 0, byClient: {} };
    }
    byManagerMap[m].fat += vlr;
    byManagerMap[m].qty += qty;
    byManagerMap[m].maco += maco;
  }

  const byManager = Object.entries(byManagerMap).map(([m, data]) => ({
    manager: m,
    fat: data.fat,
    qty: data.qty,
    maco: data.maco
  }));
  return byManager;
}

async function run() {
  const sales = await fetchAllSales('2026-05-01', '2026-05-31');
  console.log(`Total matched sales for May 2026: ${sales.length}`);
  const agg = aggregate(sales, 0);
  console.log(agg);
}
run();
