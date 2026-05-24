import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// In-memory cache to dramatically speed up dashboard (cleared on reload)
const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos de cache em memória
// Cache clearing comment to force Next.js hot reload (Bypass Cache)

interface SaleRow {
  manager: string | null;
  rede: string | null;
  nome_parceiro: string | null;
  tipo_produto: string | null;
  product: string | null;
  invoice_date: string | null;
  net_value: number | string;
  quantity: number | string;
  imposto: number | string;
  custo_total: number | string;
  custo_frete: number | string;
  receita_frete: number | string;
  uf?: string | null;
  canal?: string | null;
  cod_natureza?: number | null;
  cod_top?: number | null;
}

let BASE_ATENDIMENTO_CACHE: Map<string, any> | null = null;
let BASE_ATENDIMENTO_TIMESTAMP = 0;

async function getBaseAtendimentoMap(supabase: SupabaseClient) {
  if (BASE_ATENDIMENTO_CACHE && Date.now() - BASE_ATENDIMENTO_TIMESTAMP < CACHE_TTL) {
    return BASE_ATENDIMENTO_CACHE;
  }
  
  const map = new Map<string, any>();
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
  
  BASE_ATENDIMENTO_CACHE = map;
  BASE_ATENDIMENTO_TIMESTAMP = Date.now();
  return map;
}

/**
 * Fetches ALL matching rows via pagination (Supabase default limit = 1000).
 * Selects only the columns needed for aggregation to minimize payload.
 */
export async function fetchAllSales(
  supabase: SupabaseClient,
  startDate: string | null,
  endDate: string | null,
  filters: Record<string, string | null>,
  baseAtendimentoMap: Map<string, any>
): Promise<SaleRow[]> {
  const all: SaleRow[] = [];
  const batchSize = 1000;
  let from = 0;
  let rawFetched = 0;
  let loops = 0;

  const rawManager = filters.manager;
  const rawFamilia = filters.familia;
  const rawUf = filters.uf;
  const rawChannel = filters.channel;
  const rawProduct = filters.product;

  const fManagers = rawManager && rawManager !== 'Todos' && rawManager !== 'all' ? rawManager.split(',') : null;
  const fFamilias = rawFamilia && rawFamilia !== 'Todas' && rawFamilia !== 'all' ? rawFamilia.split(',') : null;
  const fUfs = rawUf && rawUf !== 'Todos' && rawUf !== 'all' ? rawUf.split(',') : null;
  const fChannels = rawChannel && rawChannel !== 'Todos' && rawChannel !== 'all' ? rawChannel.split(',') : null;
  const fProducts = rawProduct && rawProduct !== 'Todos' && rawProduct !== 'all' ? rawProduct.split(',') : null;

  // Pre-filter valid partner codes to dramatically reduce DB payload
  const validPartnerCodes: number[] = [];
  for (const [codStr, baseRow] of Array.from(baseAtendimentoMap.entries())) {
    if (!baseRow.manager) continue;
    if (fManagers && !fManagers.includes(baseRow.manager)) continue;
    if (fUfs && !fUfs.includes(baseRow.uf)) continue;
    if (fChannels && !fChannels.includes(baseRow.canal)) continue;
    validPartnerCodes.push(parseInt(codStr, 10));
  }

  // If no partners match the strict base_atendimento filters, return empty instantly
  if (validPartnerCodes.length === 0) {
    return Object.assign([], { rawFetched: 0, loops: 0 });
  }

  const DIGITAL_SELLERS = ['SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'];

  const CHUNK_SIZE = 200;
  const chunks = [];
  for (let i = 0; i < validPartnerCodes.length; i += CHUNK_SIZE) {
    chunks.push(validPartnerCodes.slice(i, i + CHUNK_SIZE));
  }

  const fetchChunk = async (chunk: number[], isDigital = false) => {
    let from = 0;
    const chunkData: any[] = [];
    while (true) {
      let query = supabase.from('cm_faturamento_sankhya')
        .select('id, dt_faturamento, cod_parceiro, nome_parceiro, desc_produto, quantidade, vlr_total_liq, custo_icms, custo_total, vlr_frete, vlr_total_st, nro_unico, nome_vendedor, cod_natureza, cod_top');
      
      if (isDigital) {
        query = query.in('nome_vendedor', DIGITAL_SELLERS);
      } else {
        query = query.in('cod_parceiro', chunk);
      }

      if (startDate) query = query.gte('dt_faturamento', startDate);
      if (endDate) query = query.lte('dt_faturamento', endDate);
      if (fProducts) query = query.in('desc_produto', fProducts);
      
      const { data, error } = await query.range(from, from + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      chunkData.push(...data);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return chunkData;
  };

  const promises = chunks.map(chunk => fetchChunk(chunk, false));
  promises.push(fetchChunk([], true)); // Digital channels

  const results = await Promise.all(promises);
  const data = results.flat();
  
  // Deduplicate
  const mergedMap = new Map();
  for (const r of data) mergedMap.set(r.id, r);
  const deduplicatedData = Array.from(mergedMap.values());
  rawFetched = deduplicatedData.length;
  console.log(`[Dashboard API] Fetched ${rawFetched} unique rows by chunking (${startDate} - ${endDate})`);

  for (const row of deduplicatedData) {
      const vend = row.nome_vendedor || '';
      let pseudoManager = null;
      let pseudoCanal = null;

      if (vend === 'SHOPIFY' || vend === 'LIVELO') {
        pseudoManager = 'Ecommerce';
        pseudoCanal = 'Ecommerce';
      } else if (['AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'AMAZON 1P'].includes(vend)) {
        pseudoManager = 'Marketplace';
        pseudoCanal = 'Marketplace';
      }

      let managerToUse = null;
      let ufToUse = null;
      let canalToUse = null;
      let redeToUse = null;

      if (pseudoManager) {
        managerToUse = pseudoManager;
        ufToUse = 'SP'; // Default
        canalToUse = pseudoCanal;
        redeToUse = pseudoManager;
      } else {
        const baseRow = baseAtendimentoMap.get(String(row.cod_parceiro));
        // Só exibir vendas com gerente atribuído
        if (!baseRow || !baseRow.manager) continue;
        managerToUse = baseRow.manager;
        ufToUse = baseRow.uf;
        canalToUse = baseRow.canal;
        redeToUse = baseRow.rede;
      }

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

      if (fManagers && !fManagers.includes(managerToUse)) continue;
      if (fFamilias && !fFamilias.includes(familia)) continue;
      if (fUfs && !fUfs.includes(ufToUse)) continue;
      if (fChannels && !fChannels.includes(canalToUse)) continue;

      all.push({
        manager: managerToUse,
        uf: ufToUse,
        canal: canalToUse,
        rede: redeToUse,
        nome_parceiro: row.nome_parceiro,
        tipo_produto: familia,
        product: row.desc_produto,
        invoice_date: row.dt_faturamento,
        net_value: row.vlr_total_liq,
        quantity: row.quantidade,
        imposto: (row.custo_icms || 0) + (row.vlr_total_st || 0),
        custo_total: row.custo_total,
        custo_frete: row.vlr_frete,
        receita_frete: 0,
        cod_natureza: row.cod_natureza,
        cod_top: row.cod_top
      });
    }

  return Object.assign(all, { rawFetched, loops });
}

/**
 * Aggregates sales data into the shapes needed by the dashboard.
 */
export function aggregate(
  sales: SaleRow[],
  investmentPct: number,
  prevMonthByClient?: Map<string, { fat: number; qty: number; maco: number }>,
  prevYearByClient?: Map<string, { fat: number; qty: number; maco: number }>
) {
  // By Manager
  const byManagerMap: Record<string, {
    fat: number; qty: number; maco: number;
    paceFat?: number; paceQty?: number; paceMaco?: number;
    byClient: Record<string, { 
      client: string; fat: number; qty: number; maco: number;
      paceFat?: number; paceQty?: number; paceMaco?: number;
    }>;
  }> = {};

  // By Familia
  const byFamiliaMap: Record<string, { fat: number; qty: number }> = {};

  // Totals
  let totalFat = 0, totalQty = 0, totalMaco = 0;

  // Track clients seen this month to easily add their PM Remaining
  const seenClients = new Set<string>();

  for (const sale of sales) {
    const m = sale.manager || 'Outros';
    const familia = sale.tipo_produto || 'Outros';
    
    const client = sale.rede || sale.nome_parceiro || 'Não Mapeado';
    
    if (m === 'Ecommerce' || m === 'Marketplace' || m === '1p') {
      // Digital sales use TOP 1100 (Venda). Let's filter out returns/transfers.
      if (Number(sale.cod_top) !== 1100) continue;
    } else {
      // Traditional sales are already filtered by the Supabase view `cm_faturamento_sankhya`
      // and mapped via `base_atendimento`. No extra Natureza/TOP filter is needed here.
    }

    const vlr = parseFloat(sale.net_value as string) || 0;
    const qty = parseFloat(sale.quantity as string) || 0;
    const imposto = parseFloat(sale.imposto as string) || 0;
    const custoTotal = parseFloat(sale.custo_total as string) || 0;
    const custoFrete = parseFloat(sale.custo_frete as string) || 0;
    const investimentos = vlr * investmentPct;
    const maco = vlr - imposto - custoTotal - custoFrete - investimentos;

    totalFat += vlr;
    totalQty += qty;
    totalMaco += maco;

    // Manager aggregation
    if (!byManagerMap[m]) {
      byManagerMap[m] = { fat: 0, qty: 0, maco: 0, byClient: {} };
    }
    byManagerMap[m].fat += vlr;
    byManagerMap[m].qty += qty;
    byManagerMap[m].maco += maco;

    // Client within manager
    if (!byManagerMap[m].byClient[client]) {
      byManagerMap[m].byClient[client] = { client, fat: 0, qty: 0, maco: 0 };
    }
    byManagerMap[m].byClient[client].fat += vlr;
    byManagerMap[m].byClient[client].qty += qty;
    byManagerMap[m].byClient[client].maco += maco;

    // Familia aggregation — skip unclassifiable rows (no product data)
    if (familia !== 'Outros') {
      if (!byFamiliaMap[familia]) {
        byFamiliaMap[familia] = { fat: 0, qty: 0 };
      }
      byFamiliaMap[familia].fat += vlr;
      byFamiliaMap[familia].qty += qty;
    }
    byManagerMap[m].byClient[client].maco += maco;
    seenClients.add(client);
  }

  // We no longer calculate Pace inside aggregate() because it caused partial matching bugs!
  // Pace will be added at the top level route handler by merging aggregate(currentSales) and aggregate(pmRemSales).
  
  let paceTotalFat = totalFat;
  let paceTotalQty = totalQty;
  let paceTotalMaco = totalMaco;

  // Ensure pace equals actual if there was no pmRem added yet
  for (const mgrData of Object.values(byManagerMap)) {
    mgrData.paceFat = mgrData.fat;
    mgrData.paceQty = mgrData.qty;
    mgrData.paceMaco = mgrData.maco;
    for (const cData of Object.values(mgrData.byClient)) {
      cData.paceFat = cData.fat;
      cData.paceQty = cData.qty;
      cData.paceMaco = cData.maco;
    }
  }

  // Convert maps to sorted arrays
  const byManager = Object.entries(byManagerMap).map(([manager, data]) => {
    const clients = Object.values(data.byClient)
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 20)
      .map(c => ({
        ...c,
        prevMonthFat: prevMonthByClient?.get(c.client)?.fat || 0,
        prevYearFat: prevYearByClient?.get(c.client)?.fat || 0,
        paceFat: c.paceFat || c.fat,
        paceQty: c.paceQty || c.qty,
        paceMaco: c.paceMaco || c.maco,
      }));
    return {
      manager,
      fat: data.fat,
      qty: data.qty,
      maco: data.maco,
      paceFat: data.paceFat || data.fat,
      paceQty: data.paceQty || data.qty,
      paceMaco: data.paceMaco || data.maco,
      topClients: clients,
    };
  }).sort((a, b) => b.fat - a.fat);

  const byFamilia = Object.entries(byFamiliaMap)
    .map(([familia, data]) => ({
      familia,
      fat: data.fat,
      qty: data.qty,
      pct: totalFat > 0 ? (data.fat / totalFat) * 100 : 0,
    }))
    .sort((a, b) => b.fat - a.fat);

  return {
    byManager,
    byFamilia,
    totals: { 
      fat: totalFat, qty: totalQty, maco: totalMaco,
      paceFat: paceTotalFat, paceQty: paceTotalQty, paceMaco: paceTotalMaco 
    },
  };
}

export async function GET(request: Request) {
  const tStart = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const investmentPct = parseFloat(searchParams.get('investment') || '0') / 100;

    const filters: Record<string, string | null> = {
      manager: searchParams.get('manager') !== 'all' ? searchParams.get('manager') : null,
      familia: searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null,
      uf: searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null,
      channel: searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null,
      product: searchParams.get('product') !== 'all' ? searchParams.get('product') : null,
    };

    // Check Cache First
    const cacheKey = JSON.stringify({ ...filters, startDate, endDate });
    /*
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log("[Dashboard] Returning cached response");
      return NextResponse.json(cached.data);
    }
    */

    console.time("Dashboard-Total");
    console.time("Dashboard-SupabaseClient");
    const supabase = await createClient();
    console.timeEnd("Dashboard-SupabaseClient");

    console.time("Dashboard-BaseAtendimento");
    const baseAtendimentoMap = await getBaseAtendimentoMap(supabase);
    console.timeEnd("Dashboard-BaseAtendimento");

    // Fetch comparison periods
    let previousMonth = { fat: 0, qty: 0, maco: 0 };
    let previousYear = { fat: 0, qty: 0, maco: 0 };
    let pmClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    let pyClientMap = new Map<string, { fat: number; qty: number; maco: number }>();

    if (startDate && endDate) {
      // Parse dates safely without timezone shift
      // startDate format is "YYYY-MM-DD"
      const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
      const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
      
      const curStart = new Date(sYear, sMonth - 1, sDay);
      let curEnd = new Date(eYear, eMonth - 1, eDay);

      // Capping curEnd to 'today' if we are looking at the current month
      const today = new Date();
      if (curStart.getFullYear() === today.getFullYear() && curStart.getMonth() === today.getMonth()) {
        if (curEnd > today) {
          curEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        }
      }

      // Previous month
      const prevMonthStart = new Date(curStart.getFullYear(), curStart.getMonth() - 1, curStart.getDate());
      const pmEndDay = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0).getDate();
      const prevMonthEnd = new Date(curEnd.getFullYear(), curEnd.getMonth() - 1, Math.min(curEnd.getDate(), pmEndDay));

      // Formatting function to avoid UTC shift
      const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      const pmStartStr = fmt(prevMonthStart);
      const pmEndStr = fmt(prevMonthEnd);

      // Same month previous year
      const prevYearStart = new Date(curStart.getFullYear() - 1, curStart.getMonth(), curStart.getDate());
      const prevYearEnd = new Date(curEnd.getFullYear() - 1, curEnd.getMonth(), curEnd.getDate());

      const pyStartStr = fmt(prevYearStart);
      const pyEndStr = fmt(prevYearEnd);

      // Remaining days of previous month (for Pace)
      const pmRemStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() + 1);
      const pmRemEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0);

      let pmRemStartStr = '';
      let pmRemEndStr = '';
      let fetchPmRem = false;

      if (pmRemStart <= pmRemEnd) {
        pmRemStartStr = fmt(pmRemStart);
        pmRemEndStr = fmt(pmRemEnd);
        fetchPmRem = true;
      }

      // Run all queries in parallel for MASSIVE performance gain!
      let pmSales: SaleRow[] = [];
      let pySales: SaleRow[] = [];
      let pmRemSales: SaleRow[] = [];

      console.time("Dashboard-Parallel-PrevQueries");
      const [pmRes, pyRes, pmRemRes] = await Promise.all([
        fetchAllSales(supabase, pmStartStr, pmEndStr, filters, baseAtendimentoMap),
        fetchAllSales(supabase, pyStartStr, pyEndStr, filters, baseAtendimentoMap),
        fetchPmRem ? fetchAllSales(supabase, pmRemStartStr, pmRemEndStr, filters, baseAtendimentoMap) : Promise.resolve([])
      ]);
      console.timeEnd("Dashboard-Parallel-PrevQueries");

      pmSales = pmRes as SaleRow[];
      pySales = pyRes as SaleRow[];
      pmRemSales = pmRemRes as SaleRow[];

      const currentSales = await fetchAllSales(supabase, startDate, endDate, filters, baseAtendimentoMap);

      const pmAgg = aggregate(pmSales, investmentPct);
      previousMonth = pmAgg.totals;

      // Build per-client map from prev month
      for (const sale of pmSales) {
        const client = sale.rede || sale.nome_parceiro || 'Não Mapeado';
        const vlr = parseFloat(sale.net_value as string) || 0;
        const qty = parseFloat(sale.quantity as string) || 0;
        const imposto = parseFloat(sale.imposto as string) || 0;
        const custoTotal = parseFloat(sale.custo_total as string) || 0;
        const custoFrete = parseFloat(sale.custo_frete as string) || 0;
        const maco = vlr - imposto - custoTotal - custoFrete - (vlr * investmentPct);
        const existing = pmClientMap.get(client) || { fat: 0, qty: 0, maco: 0 };
        pmClientMap.set(client, { fat: existing.fat + vlr, qty: existing.qty + qty, maco: existing.maco + maco });
      }

      const pyAgg = aggregate(pySales, investmentPct);
      previousYear = pyAgg.totals;

      // Build per-client map from prev year
      for (const sale of pySales) {
        const client = sale.rede || sale.nome_parceiro || 'Não Mapeado';
        const vlr = parseFloat(sale.net_value as string) || 0;
        const qty = parseFloat(sale.quantity as string) || 0;
        const imposto = parseFloat(sale.imposto as string) || 0;
        const custoTotal = parseFloat(sale.custo_total as string) || 0;
        const custoFrete = parseFloat(sale.custo_frete as string) || 0;
        const maco = vlr - imposto - custoTotal - custoFrete - (vlr * investmentPct);
        const existing = pyClientMap.get(client) || { fat: 0, qty: 0, maco: 0 };
        pyClientMap.set(client, { fat: existing.fat + vlr, qty: existing.qty + qty, maco: existing.maco + maco });
      }

      const aggregated = aggregate(currentSales, investmentPct, pmClientMap, pyClientMap);

      // Merge Pace directly using aggregate output! This fixes all mapping and filtering bugs.
      if (pmRemSales && pmRemSales.length > 0) {
        const pmRemAgg = aggregate(pmRemSales, investmentPct);
        
        // Add to Pace Totals
        aggregated.totals.paceFat += pmRemAgg.totals.fat;
        aggregated.totals.paceQty += pmRemAgg.totals.qty;
        aggregated.totals.paceMaco += pmRemAgg.totals.maco;

        // Add to Pace by Manager
        for (const remMgr of pmRemAgg.byManager) {
          const targetMgr = aggregated.byManager.find(m => m.manager === remMgr.manager);
          if (targetMgr) {
            targetMgr.paceFat += remMgr.fat;
            targetMgr.paceQty += remMgr.qty;
            targetMgr.paceMaco += remMgr.maco;
          } else {
            // Manager didn't sell anything this month, but we project they will sell!
            aggregated.byManager.push({
              manager: remMgr.manager,
              fat: 0, qty: 0, maco: 0,
              paceFat: remMgr.fat, paceQty: remMgr.qty, paceMaco: remMgr.maco,
              topClients: [] // Optional: We could include clients, but top level pace is enough.
            });
          }
        }
      }

      console.log('DEBUG DASHBOARD BY MANAGER:', aggregated.byManager.map((b: any) => b.manager));

      const payload = {
        success: true,
        salesCount: currentSales.length,
        ...aggregated,
        previousMonth,
        previousYear,
        recordCount: currentSales.length,
      };

      const pmStats = pmSales as any;
      const pyStats = pySales as any;
      const currStats = currentSales as any;

      const tEnd = Date.now();
      import('fs').then(fs => {
        fs.writeFileSync('debug_timing.json', JSON.stringify({
          durationMs: tEnd - tStart,
          pmSalesCount: pmSales.length,
          pySalesCount: pySales.length,
          currentSalesCount: currentSales.length,
          rawFetched: {
            pm: pmStats.rawFetched,
            py: pyStats.rawFetched,
            curr: currStats.rawFetched
          },
          loops: {
            pm: pmStats.loops,
            py: pyStats.loops,
            curr: currStats.loops
          }
        }, null, 2));
      });

      // Save to Cache
      API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });

      return NextResponse.json(payload);
    } else {
      // Fallback if no dates
      const sales = await fetchAllSales(supabase, startDate, endDate, filters, baseAtendimentoMap);
      const result = aggregate(sales, investmentPct);

      const payload = {
        success: true,
        salesCount: sales.length,
        ...result,
        previousMonth,
        previousYear,
        recordCount: sales.length,
      };

      // Save to Cache
      API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });

      return NextResponse.json(payload);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Dashboard API] Error:', message);
    try {
      require('fs').writeFileSync('api_crash.log', message + '\n' + (error instanceof Error ? error.stack : ''));
    } catch(e) {}
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
// force restart 6
// force restart 7
// force restart 8
// force restart 9
