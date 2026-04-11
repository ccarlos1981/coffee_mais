import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

// In-memory cache to dramatically speed up dashboard
const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 2; // 2 minutos

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

interface SaleRow {
  invoice_date: string | null;
  manager: string | null;
  rede: string | null;
  nome_parceiro: string | null;
  tipo_produto: string | null;
  net_value: number | string;
  quantity: number | string;
  imposto: number | string;
  custo_total: number | string;
  custo_frete: number | string;
  receita_frete: number | string;
}

async function fetchAllSalesHistory(
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
        'invoice_date, manager, rede, nome_parceiro, tipo_produto, ' +
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    let startDate, endDate;
    if (startStr && endStr) {
      startDate = `${startStr}-01`;
      const [year, month] = endStr.split("-");
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${endStr}-${String(lastDay).padStart(2, "0")}`;
    } else {
      // Fallback para comportamento original se faltar params
      const endYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
      const startYear = endYear - 2; // Last 3 years inclusive
      startDate = `${startYear}-01-01`;
      endDate = `${endYear}-12-31`;
    }

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
    };

    const investmentPct = parseFloat(searchParams.get("investment") || "0") / 100;

    // Check Cache First
    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();
    const sales = await fetchAllSalesHistory(supabase, startDate, endDate, filters);

    // Month-by-month aggregation Map: "YYYY-MM"
    const byMonthMap: Record<string, {
      monthKey: string; year: string; fat: number; qty: number; maco: number;
    }> = {};

    // For Donut Charts
    const byFamiliaMap: Record<string, { fat: number; qty: number; maco: number }> = {};
    const byClientMap: Record<string, { fat: number; qty: number; maco: number }> = {};

    let totalFat = 0, totalQty = 0, totalMaco = 0;

    for (const sale of sales) {
      if (!sale.invoice_date) continue;
      const monthPrefix = sale.invoice_date.slice(0, 7); // "YYYY-MM"
      const year = sale.invoice_date.slice(0, 4);

      const familia = sale.tipo_produto || 'Outros';
      const client = sale.nome_parceiro || sale.rede || 'Não Mapeado';

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

      // By Month
      if (!byMonthMap[monthPrefix]) {
        byMonthMap[monthPrefix] = { monthKey: monthPrefix, year, fat: 0, qty: 0, maco: 0 };
      }
      byMonthMap[monthPrefix].fat += vlr;
      byMonthMap[monthPrefix].qty += qty;
      byMonthMap[monthPrefix].maco += maco;

      // By Familia
      if (!byFamiliaMap[familia]) {
        byFamiliaMap[familia] = { fat: 0, qty: 0, maco: 0 };
      }
      byFamiliaMap[familia].fat += vlr;
      byFamiliaMap[familia].qty += qty;
      byFamiliaMap[familia].maco += maco;

      // By Client
      if (!byClientMap[client]) {
        byClientMap[client] = { fat: 0, qty: 0, maco: 0 };
      }
      byClientMap[client].fat += vlr;
      byClientMap[client].qty += qty;
      byClientMap[client].maco += maco;
    }

    // Sort Month array
    const monthlyHistory = Object.values(byMonthMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Sort Familias
    const byFamilia = Object.entries(byFamiliaMap)
      .map(([familia, data]) => ({ familia, ...data }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 10);

    // Sort Clients
    const byClient = Object.entries(byClientMap)
      .map(([client, data]) => ({ client, ...data }))
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 10);

    const result = {
      success: true,
      monthlyHistory,
      byFamilia,
      byClient,
      totals: { fat: totalFat, qty: totalQty, maco: totalMaco }
    };
    
    // Save to Cache
    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Dashboard history API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
