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

    // Maps por Mês
    const months = new Set<string>();

    // Matriz x Mês => SKUs distintos vendidos naquele mês
    const matrizMonthMap: Record<string, Record<string, Set<string>>> = {};
    const matrizTotalQty: Record<string, number> = {};

    // Cliente x Mês => SKUs distintos que comprou naquele mês
    const clienteMonthMap: Record<string, Record<string, Set<string>>> = {};
    const clienteTotalQty: Record<string, number> = {};

    for (const sale of sales) {
      const monthKey = sale.invoice_date ? sale.invoice_date.substring(0, 7) : 'Unknown';
      const cliente = sale.nome_parceiro || 'Não Mapeado';
      const matriz = sale.rede || 'Não Mapeado';
      const sku = sale.product || 'Outros';
      const qty = parseFloat(sale.quantity as string) || 0;

      months.add(monthKey);

      // Matriz: quantos SKUs distintos foram vendidos naquele mês
      if (!matrizMonthMap[matriz]) matrizMonthMap[matriz] = {};
      if (!matrizMonthMap[matriz][monthKey]) matrizMonthMap[matriz][monthKey] = new Set();
      matrizMonthMap[matriz][monthKey].add(sku);
      matrizTotalQty[matriz] = (matrizTotalQty[matriz] || 0) + qty;

      // Cliente: quantos SKUs distintos comprou naquele mês
      if (!clienteMonthMap[cliente]) clienteMonthMap[cliente] = {};
      if (!clienteMonthMap[cliente][monthKey]) clienteMonthMap[cliente][monthKey] = new Set();
      clienteMonthMap[cliente][monthKey].add(sku);
      clienteTotalQty[cliente] = (clienteTotalQty[cliente] || 0) + qty;
    }

    const sortedMonths = Array.from(months).sort();

    // Batalha Naval por Matriz: todas, rankeadas por total qty
    const byMatriz = Object.entries(matrizTotalQty)
      .sort((a, b) => b[1] - a[1])
      .map(([matriz]) => {
        const monthData: Record<string, number> = {};
        for (const m of sortedMonths) {
          monthData[m] = matrizMonthMap[matriz]?.[m]?.size || 0;
        }
        return { name: matriz, months: monthData, totalQty: matrizTotalQty[matriz] };
      });

    // Batalha Naval por Cliente: todas, rankeadas por total qty
    const byCliente = Object.entries(clienteTotalQty)
      .sort((a, b) => b[1] - a[1])
      .map(([cliente]) => {
        const monthData: Record<string, number> = {};
        for (const m of sortedMonths) {
          monthData[m] = clienteMonthMap[cliente]?.[m]?.size || 0;
        }
        return { name: cliente, months: monthData, totalQty: clienteTotalQty[cliente] };
      });

    const payload = {
      success: true,
      totals: {
        matrizes: Object.keys(matrizMonthMap).length,
        clientes: Object.keys(clienteMonthMap).length,
        meses: sortedMonths.length,
      },
      byMatriz,
      byCliente,
      months: sortedMonths,
      recordCount: sales.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação Matriz API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
