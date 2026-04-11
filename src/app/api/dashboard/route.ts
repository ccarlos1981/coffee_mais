import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

// In-memory cache to dramatically speed up dashboard
const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutos

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface SaleRow {
  manager: string | null;
  rede: string | null;
  nome_parceiro: string | null;
  tipo_produto: string | null;
  product: string | null;
  net_value: number | string;
  quantity: number | string;
  imposto: number | string;
  custo_total: number | string;
  custo_frete: number | string;
  receita_frete: number | string;
}

/**
 * Fetches ALL matching rows via pagination (Supabase default limit = 1000).
 * Selects only the columns needed for aggregation to minimize payload.
 */
async function fetchAllSales(
  supabase: ReturnType<typeof getSupabaseClient>,
  startDate: string | null,
  endDate: string | null,
  filters: Record<string, string | null>
): Promise<SaleRow[]> {
  const all: SaleRow[] = [];
  const batchSize = 1000;
  let from = 0;

  while (true) {
    let query = supabase
      .from('sales')
      .select(
        'manager, rede, nome_parceiro, tipo_produto, product, ' +
        'net_value, quantity, imposto, custo_total, custo_frete, receita_frete'
      );

    if (startDate) query = query.gte('invoice_date', startDate);
    if (endDate) query = query.lte('invoice_date', endDate);
    if (filters.manager) query = query.in('manager', filters.manager.split(','));
    if (filters.familia) query = query.in('tipo_produto', filters.familia.split(','));
    if (filters.uf) query = query.in('uf', filters.uf.split(','));
    if (filters.channel) query = query.in('channel', filters.channel.split(','));
    if (filters.product) query = query.in('product', filters.product.split(','));

    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as unknown as SaleRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return all;
}

/**
 * Aggregates sales data into the shapes needed by the dashboard.
 */
function aggregate(
  sales: SaleRow[],
  investmentPct: number,
  prevMonthByClient?: Map<string, { fat: number; qty: number; maco: number }>,
  prevYearByClient?: Map<string, { fat: number; qty: number; maco: number }>
) {
  // By Manager
  const byManagerMap: Record<string, {
    fat: number; qty: number; maco: number;
    byClient: Record<string, { client: string; fat: number; qty: number; maco: number }>;
  }> = {};

  // By Familia
  const byFamiliaMap: Record<string, { fat: number; qty: number }> = {};

  // Totals
  let totalFat = 0, totalQty = 0, totalMaco = 0;

  for (const sale of sales) {
    const m = sale.manager || 'Sem Gerente';
    let familia = sale.tipo_produto;
    if (!familia || familia === 'Outros') {
      const p = (sale.product || '').toString().toUpperCase();
      if (p.includes('1KG')) familia = '1 KG';
      else if (p.includes('5KG') || p.includes('5 KG')) familia = '5 KG';
      else if (p.includes('CAPSULA') || p.includes('CÁPSULA')) familia = 'Cápsula';
      else if (p.includes('DRIP')) familia = 'Drip';
      else if (p.includes('GEISHA')) familia = 'Geisha';
      else if (p.includes('VERDE')) familia = 'Café Verde';
      else if (p.includes('GRAO') || p.includes('GRÃO')) familia = 'Grão';
      else if (p.includes('MOIDO') || p.includes('MOÍDO')) familia = 'Moído';
      else if (p.includes('ACESSORIO') || p.includes('GARRAFA') || p.includes('CANECA') || p.includes('KIT')) familia = 'Acessório';
      else familia = 'Outros';
    }
    
    const client = sale.rede || sale.nome_parceiro || 'Não Mapeado';

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
      }));
    return {
      manager,
      fat: data.fat,
      qty: data.qty,
      maco: data.maco,
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
    totals: { fat: totalFat, qty: totalQty, maco: totalMaco },
  };
}

export async function GET(request: Request) {
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
    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();

    // Fetch comparison periods
    let previousMonth = { fat: 0, qty: 0, maco: 0 };
    let previousYear = { fat: 0, qty: 0, maco: 0 };
    let pmClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    let pyClientMap = new Map<string, { fat: number; qty: number; maco: number }>();

    if (startDate && endDate) {
      const curStart = new Date(startDate);
      const curEnd = new Date(endDate);

      // Previous month
      const prevMonthStart = new Date(curStart);
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
      const prevMonthEnd = new Date(curEnd);
      prevMonthEnd.setMonth(prevMonthEnd.getMonth() - 1);
      const pmEndDay = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0).getDate();
      prevMonthEnd.setDate(Math.min(prevMonthEnd.getDate(), pmEndDay));

      const pmSales = await fetchAllSales(
        supabase,
        prevMonthStart.toISOString().split('T')[0],
        prevMonthEnd.toISOString().split('T')[0],
        filters
      );
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

      // Same month previous year
      const prevYearStart = new Date(curStart);
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1);
      const prevYearEnd = new Date(curEnd);
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

      const pySales = await fetchAllSales(
        supabase,
        prevYearStart.toISOString().split('T')[0],
        prevYearEnd.toISOString().split('T')[0],
        filters
      );
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
    }

    // Fetch current period (with comparison maps)
    const sales = await fetchAllSales(supabase, startDate, endDate, filters);
    const result = aggregate(sales, investmentPct, pmClientMap, pyClientMap);

    const payload = {
      success: true,
      ...result,
      previousMonth,
      previousYear,
      recordCount: sales.length,
    };
    
    // Save to Cache
    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Dashboard API] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
