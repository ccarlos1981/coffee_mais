import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

// In-memory cache
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
  invoice_date: string | null;
}

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
        'net_value, quantity, imposto, custo_total, custo_frete, receita_frete, invoice_date'
      );

    if (startDate) query = query.gte('invoice_date', startDate);
    if (endDate) query = query.lte('invoice_date', endDate);
    if (filters.manager) query = query.in('manager', filters.manager.split(','));
    if (filters.familia) query = query.in('tipo_produto', filters.familia.split(','));
    if (filters.uf) query = query.in('uf', filters.uf.split(','));
    if (filters.channel) query = query.in('channel', filters.channel.split(','));
    if (filters.product) query = query.in('product', filters.product.split(','));
    if (filters.matriz) query = query.in('rede', filters.matriz.split(','));

    const { data, error } = await query.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...(data as unknown as SaleRow[]));
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return all;
}

function aggregate(sales: SaleRow[], investmentPct: number) {
  const byMatrizMap: Record<string, {
    fat: number; qty: number; maco: number;
    // v_futura, devolucoes, bonif -> mocked as 0 in UI per user request, we only return real ones here
  }> = {};

  const byManagerMap: Record<string, { fat: number }> = {};
  const byProductMap: Record<string, { fat: number; qty: number }> = {};
  const byFamiliaMap: Record<string, { fat: number }> = {};
  const byMonthMap: Record<string, { fat: number; qty: number, maco: number }> = {};

  let totalFat = 0, totalQty = 0, totalMaco = 0;

  for (const sale of sales) {
    const matriz = sale.rede || sale.nome_parceiro || 'Não Mapeado';
    const m = sale.manager || 'Sem Gerente';
    const familia = sale.tipo_produto || 'Outros';
    const prod = sale.product || 'Outros';

    const vlr = parseFloat(sale.net_value as string) || 0;
    const qty = parseFloat(sale.quantity as string) || 0;
    const imposto = parseFloat(sale.imposto as string) || 0;
    const custoTotal = parseFloat(sale.custo_total as string) || 0;
    const custoFrete = parseFloat(sale.custo_frete as string) || 0;
    const investimentos = vlr * investmentPct;
    const maco = vlr - imposto - custoTotal - custoFrete - investimentos;
    
    let monthKey = 'Unknown';
    if (sale.invoice_date) {
        // e.g. "2026-03-15" => "2026-03"
        monthKey = sale.invoice_date.substring(0, 7); 
    }

    totalFat += vlr;
    totalQty += qty;
    totalMaco += maco;

    // Matriz
    if (!byMatrizMap[matriz]) byMatrizMap[matriz] = { fat: 0, qty: 0, maco: 0 };
    byMatrizMap[matriz].fat += vlr;
    byMatrizMap[matriz].qty += qty;
    byMatrizMap[matriz].maco += maco;

    // Manager
    if (!byManagerMap[m]) byManagerMap[m] = { fat: 0 };
    byManagerMap[m].fat += vlr;

    // Product
    if (!byProductMap[prod]) byProductMap[prod] = { fat: 0, qty: 0 };
    byProductMap[prod].fat += vlr;
    byProductMap[prod].qty += qty;

    // Familia
    if (!byFamiliaMap[familia]) byFamiliaMap[familia] = { fat: 0 };
    byFamiliaMap[familia].fat += vlr;

    // Month
    if (!byMonthMap[monthKey]) byMonthMap[monthKey] = { fat: 0, qty: 0, maco: 0 };
    byMonthMap[monthKey].fat += vlr;
    byMonthMap[monthKey].qty += qty;
    byMonthMap[monthKey].maco += maco;
  }

  // Formatting output
  const byMatriz = Object.entries(byMatrizMap).map(([matriz, data]) => ({
    matriz,
    fat: data.fat,
    qty: data.qty,
    rk_kg: data.qty > 0 ? data.fat / data.qty : 0,
    maco: data.maco,
    maco_kg: data.qty > 0 ? data.maco / data.qty : 0,
    v_futura: 0, 
    devolucoes: 0,
    bonif: 0
  })).sort((a, b) => b.fat - a.fat)
  .map((m, i) => ({ ...m, rank: i + 1 }));

  const byManager = Object.entries(byManagerMap).map(([name, data]) => ({
    name,
    fat: data.fat,
    pct: totalFat > 0 ? (data.fat / totalFat) * 100 : 0
  })).sort((a, b) => b.fat - a.fat);

  const byProduct = Object.entries(byProductMap).map(([product, data]) => ({
    product,
    fat: data.fat,
    qty: data.qty
  })).sort((a, b) => b.fat - a.fat).slice(0, 15); // limit to top 15 products

  const byFamilia = Object.entries(byFamiliaMap).map(([familia, data]) => ({
    familia,
    fat: data.fat,
    pct: totalFat > 0 ? (data.fat / totalFat) * 100 : 0
  })).sort((a, b) => b.fat - a.fat);

  const byMonth = Object.entries(byMonthMap).map(([month, data]) => ({
    month,
    fat: data.fat,
    qty: data.qty,
    maco: data.maco
  })).sort((a, b) => a.month.localeCompare(b.month));

  return {
    totals: { fat: totalFat, qty: totalQty, maco: totalMaco },
    byMatriz,
    byManager,
    byProduct,
    byFamilia,
    byMonth
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const investmentPct = parseFloat(searchParams.get('investment') || '0') / 100;
    
    // For the history chart, we need more months. Let's get up to 12 months back if requested.
    const enableHistory = searchParams.get('history') === 'true';

    const filters: Record<string, string | null> = {
      manager: searchParams.get('manager') !== 'all' ? searchParams.get('manager') : null,
      familia: searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null,
      uf: searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null,
      channel: searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null,
      product: searchParams.get('product') !== 'all' ? searchParams.get('product') : null,
      matriz: searchParams.get('matriz') !== 'all' ? searchParams.get('matriz') : null,
    };

    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();
    
    let queryStart = startDate;
    if (enableHistory && endDate) {
       // get last 12 months history
       const dateObj = new Date(endDate);
       dateObj.setMonth(dateObj.getMonth() - 11);
       queryStart = dateObj.toISOString().split('T')[0];
    }

    const sales = await fetchAllSales(supabase, queryStart, endDate, filters);
    
    // To keep "Matriz" table aligned to current month selection ONLY,
    // we split the sales into two parts if history is enabled.
    let currentPeriodSales = sales;
    if (enableHistory && startDate) {
      currentPeriodSales = sales.filter(s => s.invoice_date && s.invoice_date >= startDate);
    }
    
    const result = aggregate(currentPeriodSales, investmentPct);
    
    // However, we want history across months:
    const historyResult = aggregate(sales, investmentPct);

    // Swap byMonth to be the full history
    if (enableHistory) {
      result.byMonth = historyResult.byMonth;
    }

    const payload = {
      success: true,
      ...result,
      recordCount: currentPeriodSales.length,
    };
    
    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Dashboard API Matriz] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
