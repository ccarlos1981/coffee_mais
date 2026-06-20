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

    // Query for families aggregated by channel
    const sqlFamilies = `
      SELECT COALESCE(channel, 'Não Mapeado') as channel,
             COALESCE(tipo_produto, 'Não Mapeado') as family,
             CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
             SUM(fat) as fat,
             SUM(qty) as qty
      FROM ${tableName}
      WHERE mes >= '${year}-01' AND mes <= '${year}-12'
        ${filterSql}
      GROUP BY COALESCE(channel, 'Não Mapeado'), COALESCE(tipo_produto, 'Não Mapeado'), CAST(SUBSTRING(mes, 6, 2) AS integer)
    `;

    console.log(`[Preço Matriz API] Querying families for ${year}`);
    const { data: rowsFamilies, error: errorFamilies } = await supabase.rpc('execute_readonly_query', { query_text: sqlFamilies });
    if (errorFamilies) throw new Error(errorFamilies.message);

    // Query for families aggregated by matriz (rede)
    const sqlMatrizFamilies = `
      SELECT COALESCE(rede, 'Não Mapeado') as matriz,
             COALESCE(tipo_produto, 'Não Mapeado') as family,
             CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
             SUM(fat) as fat,
             SUM(qty) as qty
      FROM ${tableName}
      WHERE mes >= '${year}-01' AND mes <= '${year}-12'
        ${filterSql}
      GROUP BY COALESCE(rede, 'Não Mapeado'), COALESCE(tipo_produto, 'Não Mapeado'), CAST(SUBSTRING(mes, 6, 2) AS integer)
    `;

    console.log(`[Preço Matriz API] Querying matriz families for ${year}`);
    const { data: rowsMatrizFamilies, error: errorMatrizFamilies } = await supabase.rpc('execute_readonly_query', { query_text: sqlMatrizFamilies });
    if (errorMatrizFamilies) throw new Error(errorMatrizFamilies.message);

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

    // Process Families Aggregation
    const familyMap = new Map<string, {
      channel: string;
      family: string;
      totalQty: number;
      totalFat: number;
      months: Record<number, { fat: number; qty: number }>;
    }>();

    for (const row of (rowsFamilies || [])) {
      const channelName = (row.channel || 'Não Mapeado') as string;
      const familyName = (row.family || 'Não Mapeado') as string;
      const mesNum = Number(row.mes_num);
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);

      const key = `${channelName}::${familyName}`;
      if (!familyMap.has(key)) {
        familyMap.set(key, {
          channel: channelName,
          family: familyName,
          totalQty: 0,
          totalFat: 0,
          months: {},
        });
      }
      const fEntry = familyMap.get(key)!;
      fEntry.totalQty += qty;
      fEntry.totalFat += fat;
      if (!fEntry.months[mesNum]) {
        fEntry.months[mesNum] = { fat: 0, qty: 0 };
      }
      fEntry.months[mesNum].fat += fat;
      fEntry.months[mesNum].qty += qty;
    }

    // Process Matriz Families Aggregation
    const matrizFamilyMap = new Map<string, {
      matriz: string;
      family: string;
      totalQty: number;
      totalFat: number;
      months: Record<number, { fat: number; qty: number }>;
    }>();

    for (const row of (rowsMatrizFamilies || [])) {
      const matrizName = (row.matriz || 'Não Mapeado') as string;
      const familyName = (row.family || 'Não Mapeado') as string;
      const mesNum = Number(row.mes_num);
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);

      const key = `${matrizName}::${familyName}`;
      if (!matrizFamilyMap.has(key)) {
        matrizFamilyMap.set(key, {
          matriz: matrizName,
          family: familyName,
          totalQty: 0,
          totalFat: 0,
          months: {},
        });
      }
      const fEntry = matrizFamilyMap.get(key)!;
      fEntry.totalQty += qty;
      fEntry.totalFat += fat;
      if (!fEntry.months[mesNum]) {
        fEntry.months[mesNum] = { fat: 0, qty: 0 };
      }
      fEntry.months[mesNum].fat += fat;
      fEntry.months[mesNum].qty += qty;
    }

    const channelsResult = Array.from(channelMap.values())
      .map(c => {
        const monthPrices: Record<number, number> = {};
        const monthQty: Record<number, number> = {};
        const monthFat: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (c.months[i]) {
            if (c.months[i].qty > 0) monthPrices[i] = c.months[i].fat / c.months[i].qty;
            monthQty[i] = c.months[i].qty;
            monthFat[i] = c.months[i].fat;
          }
        }
        const avgPrice = c.totalQty > 0 ? c.totalFat / c.totalQty : 0;
        return {
          channel: c.channel,
          totalQty: c.totalQty,
          totalFat: c.totalFat,
          avgPrice,
          monthPrices,
          monthQty,
          monthFat,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    const matrizesResult = Array.from(matrizMap.values())
      .map(m => {
        const monthPrices: Record<number, number> = {};
        const monthQty: Record<number, number> = {};
        const monthFat: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (m.months[i]) {
            if (m.months[i].qty > 0) monthPrices[i] = m.months[i].fat / m.months[i].qty;
            monthQty[i] = m.months[i].qty;
            monthFat[i] = m.months[i].fat;
          }
        }
        const avgPrice = m.totalQty > 0 ? m.totalFat / m.totalQty : 0;
        return {
          matriz: m.matriz,
          totalQty: m.totalQty,
          totalFat: m.totalFat,
          avgPrice,
          monthPrices,
          monthQty,
          monthFat,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    // Process Families Result
    const familiesResult = Array.from(familyMap.values())
      .map(f => {
        const monthPrices: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (f.months[i] && f.months[i].qty > 0) {
            monthPrices[i] = f.months[i].fat / f.months[i].qty;
          }
        }
        const avgPrice = f.totalQty > 0 ? f.totalFat / f.totalQty : 0;
        return {
          channel: f.channel,
          family: f.family,
          totalQty: f.totalQty,
          totalFat: f.totalFat,
          avgPrice,
          monthPrices,
        };
      })
      .sort((a, b) => b.totalQty - a.totalQty);

    // Process Matriz Families Result
    const matrizFamiliesResult = Array.from(matrizFamilyMap.values())
      .map(f => {
        const monthPrices: Record<number, number> = {};
        for (let i = 1; i <= 12; i++) {
          if (f.months[i] && f.months[i].qty > 0) {
            monthPrices[i] = f.months[i].fat / f.months[i].qty;
          }
        }
        const avgPrice = f.totalQty > 0 ? f.totalFat / f.totalQty : 0;
        return {
          matriz: f.matriz,
          family: f.family,
          totalQty: f.totalQty,
          totalFat: f.totalFat,
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
      families: familiesResult,
      matrizFamilies: matrizFamiliesResult,
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
