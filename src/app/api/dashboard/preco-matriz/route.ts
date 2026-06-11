import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

function escapeSqlValue(value: string | null) {
  if (!value) return "NULL";
  return "'" + value.replace(/'/g, "''") + "'";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const year = searchParams.get("year") || "2026";

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
      matriz: searchParams.get("matriz"),
    };

    const hasProductFilter = filters.product && filters.product !== 'all' && filters.product.length > 0;
    const tableName = hasProductFilter ? 'mv_positivacao_sku_mensal' : 'mv_vendas_mensal';

    const supabase = getSupabaseClient();

    let filterSql = '';
    if (filters.manager && filters.manager !== 'all') {
      filterSql += ` AND manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.familia && filters.familia !== 'all') {
      filterSql += ` AND tipo_produto IN (${filters.familia.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.uf && filters.uf !== 'all') {
      filterSql += ` AND uf IN (${filters.uf.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.channel && filters.channel !== 'all') {
      filterSql += ` AND channel IN (${filters.channel.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.matriz && filters.matriz !== 'all') {
      filterSql += ` AND rede IN (${filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (hasProductFilter) {
      filterSql += ` AND product IN (${filters.product!.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }

    const sql = `
      SELECT COALESCE(channel, 'Não Mapeado') as channel,
             COALESCE(rede, 'Não Mapeado') as matriz,
             CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
             SUM(fat) as fat,
             SUM(qty) as qty
      FROM ${tableName}
      WHERE mes >= '${year}-01' AND mes <= '${year}-12'
        ${filterSql}
      GROUP BY COALESCE(channel, 'Não Mapeado'), COALESCE(rede, 'Não Mapeado'), CAST(SUBSTRING(mes, 6, 2) AS integer)
    `;

    console.log(`[Preço Matriz API] Querying ${year}`);
    const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) throw new Error(error.message);

    // Build maps for channels and matrizes
    const channelMap = new Map<string, {
      channel: string;
      totalQty: number;
      totalFat: number;
      months: Record<number, { fat: number; qty: number }>;
    }>();

    const matrizMap = new Map<string, {
      matriz: string;
      totalQty: number;
      totalFat: number;
      months: Record<number, { fat: number; qty: number }>;
    }>();

    for (const row of (rows || [])) {
      const channelName = (row.channel || 'Não Mapeado') as string;
      const matrizName = (row.matriz || 'Não Mapeado') as string;
      const mesNum = Number(row.mes_num);
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);

      // 1. Channel Aggregation
      if (!channelMap.has(channelName)) {
        channelMap.set(channelName, {
          channel: channelName,
          totalQty: 0,
          totalFat: 0,
          months: {},
        });
      }
      const cEntry = channelMap.get(channelName)!;
      cEntry.totalQty += qty;
      cEntry.totalFat += fat;
      if (!cEntry.months[mesNum]) {
        cEntry.months[mesNum] = { fat: 0, qty: 0 };
      }
      cEntry.months[mesNum].fat += fat;
      cEntry.months[mesNum].qty += qty;

      // 2. Matriz Aggregation
      if (!matrizMap.has(matrizName)) {
        matrizMap.set(matrizName, {
          matriz: matrizName,
          totalQty: 0,
          totalFat: 0,
          months: {},
        });
      }
      const mEntry = matrizMap.get(matrizName)!;
      mEntry.totalQty += qty;
      mEntry.totalFat += fat;
      if (!mEntry.months[mesNum]) {
        mEntry.months[mesNum] = { fat: 0, qty: 0 };
      }
      mEntry.months[mesNum].fat += fat;
      mEntry.months[mesNum].qty += qty;
    }

    // Process Channels Result
    const channelsResult = Array.from(channelMap.values())
      .map(c => {
        const monthPrices: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (c.months[i] && c.months[i].qty > 0) {
            monthPrices[i] = c.months[i].fat / c.months[i].qty;
          }
        }
        const avgPrice = c.totalQty > 0 ? c.totalFat / c.totalQty : 0;
        return {
          channel: c.channel,
          totalQty: c.totalQty,
          totalFat: c.totalFat,
          avgPrice,
          monthPrices,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    // Process Matrizes Result
    const matrizesResult = Array.from(matrizMap.values())
      .map(m => {
        const monthPrices: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (m.months[i] && m.months[i].qty > 0) {
            monthPrices[i] = m.months[i].fat / m.months[i].qty;
          }
        }
        const avgPrice = m.totalQty > 0 ? m.totalFat / m.totalQty : 0;
        return {
          matriz: m.matriz,
          totalQty: m.totalQty,
          totalFat: m.totalFat,
          avgPrice,
          monthPrices,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    return NextResponse.json({
      success: true,
      data: matrizesResult, // backward compatibility
      channels: channelsResult,
      matrizes: matrizesResult,
      year,
    });
  } catch (error: unknown) {
    console.error("Preço Matriz API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
