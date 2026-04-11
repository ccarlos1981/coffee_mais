import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 15;

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
  invoice_date: string | null;
  net_value: number | string;
  quantity: number | string;
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
      .select('manager, rede, nome_parceiro, tipo_produto, product, invoice_date, net_value, quantity');

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
    const sales = await fetchAllSales(supabase, startDate, endDate, filters);

    // ==================== POSITIVAÇÃO ====================
    // Geral por mês: quantos clientes distintos compraram
    // byMonth: { month, clientesDistintos, matrizesDistintas, fat, qty }
    const monthClientMap: Record<string, Set<string>> = {};
    const monthMatrizMap: Record<string, Set<string>> = {};
    const monthFatMap: Record<string, number> = {};
    const monthQtyMap: Record<string, number> = {};

    // Batalha Naval: SKU x Mês => quantos clientes distintos compraram aquele SKU naquele mês
    // skuMonthMap: { sku => { month => Set<client> } }
    const skuMonthMap: Record<string, Record<string, Set<string>>> = {};
    // Total sales per SKU (for ranking)
    const skuTotalQty: Record<string, number> = {};

    // Por Gerente: positivação por gerente (clientes distintos)
    const managerClientMap: Record<string, Set<string>> = {};
    const managerMatrizMap: Record<string, Set<string>> = {};
    const managerFatMap: Record<string, number> = {};
    // Gerente x Mês => clientes distintos
    const managerMonthClientMap: Record<string, Record<string, Set<string>>> = {};

    for (const sale of sales) {
      const monthKey = sale.invoice_date ? sale.invoice_date.substring(0, 7) : 'Unknown';
      const client = sale.nome_parceiro || sale.rede || 'Não Mapeado';
      const matriz = sale.rede || 'Não Mapeado';
      const sku = sale.product || 'Outros';
      const manager = sale.manager || 'Sem Gerente';
      const vlr = parseFloat(sale.net_value as string) || 0;
      const qty = parseFloat(sale.quantity as string) || 0;

      // Mês geral
      if (!monthClientMap[monthKey]) {
        monthClientMap[monthKey] = new Set();
        monthMatrizMap[monthKey] = new Set();
        monthFatMap[monthKey] = 0;
        monthQtyMap[monthKey] = 0;
      }
      monthClientMap[monthKey].add(client);
      monthMatrizMap[monthKey].add(matriz);
      monthFatMap[monthKey] += vlr;
      monthQtyMap[monthKey] += qty;

      // SKU x Mês (batalha naval)
      if (!skuMonthMap[sku]) skuMonthMap[sku] = {};
      if (!skuMonthMap[sku][monthKey]) skuMonthMap[sku][monthKey] = new Set();
      skuMonthMap[sku][monthKey].add(client);

      if (!skuTotalQty[sku]) skuTotalQty[sku] = 0;
      skuTotalQty[sku] += qty;

      // Gerente
      if (!managerClientMap[manager]) {
        managerClientMap[manager] = new Set();
        managerMatrizMap[manager] = new Set();
        managerFatMap[manager] = 0;
        managerMonthClientMap[manager] = {};
      }
      managerClientMap[manager].add(client);
      managerMatrizMap[manager].add(matriz);
      managerFatMap[manager] += vlr;

      if (!managerMonthClientMap[manager][monthKey]) managerMonthClientMap[manager][monthKey] = new Set();
      managerMonthClientMap[manager][monthKey].add(client);
    }

    // Format byMonth
    const months = Object.keys(monthClientMap).sort();
    const byMonth = months.map(m => ({
      month: m,
      clientes: monthClientMap[m].size,
      matrizes: monthMatrizMap[m].size,
      fat: monthFatMap[m],
      qty: monthQtyMap[m],
    }));

    // Totals
    const allClients = new Set<string>();
    const allMatrizes = new Set<string>();
    let totalFat = 0;
    for (const sale of sales) {
      const client = sale.nome_parceiro || sale.rede || 'Não Mapeado';
      const matriz = sale.rede || 'Não Mapeado';
      allClients.add(client);
      allMatrizes.add(matriz);
      totalFat += parseFloat(sale.net_value as string) || 0;
    }

    // Batalha Naval: top 20 SKUs ranked by total qty
    const topSkus = Object.entries(skuTotalQty)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([sku]) => sku);

    const batalhaNaval = topSkus.map(sku => {
      const monthData: Record<string, number> = {};
      for (const m of months) {
        monthData[m] = skuMonthMap[sku]?.[m]?.size || 0;
      }
      return { sku, months: monthData, totalQty: skuTotalQty[sku] };
    });

    // Últimos 6 meses para tabela de gerentes
    const last6Months = months.slice(-12);

    // Por Gerente
    const byManager = Object.keys(managerClientMap).map(manager => {
      const monthlyData: Record<string, number> = {};
      for (const m of last6Months) {
        monthlyData[m] = managerMonthClientMap[manager]?.[m]?.size || 0;
      }
      return {
        manager,
        clientes: managerClientMap[manager].size,
        matrizes: managerMatrizMap[manager].size,
        fat: managerFatMap[manager],
        monthly: monthlyData,
      };
    }).sort((a, b) => b.clientes - a.clientes);

    const payload = {
      success: true,
      totals: {
        clientes: allClients.size,
        matrizes: allMatrizes.size,
        fat: totalFat,
        meses: months.length,
      },
      byMonth,
      byManager,
      batalhaNaval,
      months,
      recordCount: sales.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
