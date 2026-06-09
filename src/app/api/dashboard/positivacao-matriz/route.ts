import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
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
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    // Query mv_positivacao_sku_mensal for SKU-level data per client
    let query = supabase
      .from('mv_positivacao_sku_mensal')
      .select('mes, manager, rede, nome_parceiro, product, qty');

    if (startMonth) query = query.gte('mes', startMonth);
    if (endMonth) query = query.lte('mes', endMonth);
    if (filters.manager) query = query.in('manager', filters.manager.split(','));
    if (filters.familia) query = query.in('tipo_produto', filters.familia.split(','));
    if (filters.uf) query = query.in('uf', filters.uf.split(','));
    if (filters.channel) query = query.in('channel', filters.channel.split(','));
    if (filters.matriz) query = query.in('rede', filters.matriz.split(','));

    console.log(`[Positivação Matriz API] Running MV query...`);
    const { data: rows, error } = await query.limit(50000);

    if (error) throw new Error(error.message);

    const allRows = rows || [];
    const monthsSet = new Set<string>();
    const matrizesSet = new Set<string>();
    const clientesSet = new Set<string>();

    // Pivot Matriz Monthly Data
    const matrizTotalQtyMap = new Map<string, number>();
    const matrizMonthSkuMap = new Map<string, Map<string, Set<string>>>();

    // Pivot Cliente Monthly Data
    const clienteTotalQtyMap = new Map<string, number>();
    const clienteMonthSkuMap = new Map<string, Map<string, Set<string>>>();

    for (const row of allRows) {
      const rede = row.rede || 'Não Mapeado';
      const client = row.nome_parceiro || 'Não Mapeado';
      const mes = row.mes;
      const product = row.product || 'Outros';
      const qty = Number(row.qty || 0);

      monthsSet.add(mes);
      matrizesSet.add(rede);
      clientesSet.add(client);

      // Matriz
      matrizTotalQtyMap.set(rede, (matrizTotalQtyMap.get(rede) || 0) + qty);
      if (!matrizMonthSkuMap.has(rede)) matrizMonthSkuMap.set(rede, new Map());
      if (!matrizMonthSkuMap.get(rede)!.has(mes)) matrizMonthSkuMap.get(rede)!.set(mes, new Set());
      matrizMonthSkuMap.get(rede)!.get(mes)!.add(product);

      // Cliente
      clienteTotalQtyMap.set(client, (clienteTotalQtyMap.get(client) || 0) + qty);
      if (!clienteMonthSkuMap.has(client)) clienteMonthSkuMap.set(client, new Map());
      if (!clienteMonthSkuMap.get(client)!.has(mes)) clienteMonthSkuMap.get(client)!.set(mes, new Set());
      clienteMonthSkuMap.get(client)!.get(mes)!.add(product);
    }

    const sortedMonths = Array.from(monthsSet).sort();

    // Build byMatriz
    const byMatriz = Array.from(matrizTotalQtyMap.entries())
      .map(([name, totalQty]) => {
        const monthData: Record<string, number> = {};
        for (const m of sortedMonths) {
          monthData[m] = matrizMonthSkuMap.get(name)?.get(m)?.size || 0;
        }
        return { name, months: monthData, totalQty };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    // Build byCliente
    const byCliente = Array.from(clienteTotalQtyMap.entries())
      .map(([name, totalQty]) => {
        const monthData: Record<string, number> = {};
        for (const m of sortedMonths) {
          monthData[m] = clienteMonthSkuMap.get(name)?.get(m)?.size || 0;
        }
        return { name, months: monthData, totalQty };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    const payload = {
      success: true,
      totals: {
        matrizes: matrizesSet.size,
        clientes: clientesSet.size,
        meses: sortedMonths.length,
      },
      byMatriz,
      byCliente,
      months: sortedMonths,
      recordCount: allRows.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação Matriz API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
