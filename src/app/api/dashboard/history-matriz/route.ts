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

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const startMonth = Number(searchParams.get("startMonth") || "1");
    const endMonth = Number(searchParams.get("endMonth") || "12");
    const startMonthStr = String(startMonth).padStart(2, '0');
    const endMonthStr = String(endMonth).padStart(2, '0');

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
      matriz: searchParams.get("matriz"),
    };

    const hasProductFilter = filters.product && filters.product !== 'all' && filters.product.length > 0;

    console.log(`[History Matriz API] Querying 2025 vs 2026 monthly range ${startMonthStr} to ${endMonthStr}`);

    const supabase = getSupabaseClient();

    // Build filters WHERE clauses
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

    let sql = '';
    if (hasProductFilter) {
      filterSql += ` AND product IN (${filters.product!.split(',').map(m => escapeSqlValue(m)).join(',')})`;
      sql = `
        SELECT SUBSTRING(mes, 1, 4) as ano,
               CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
               SUM(fat) as fat, SUM(qty) as qty
        FROM mv_positivacao_sku_mensal
        WHERE (mes >= '2025-01' AND mes <= '2026-12')
           ${filterSql}
        GROUP BY SUBSTRING(mes, 1, 4), CAST(SUBSTRING(mes, 6, 2) AS integer)
      `;
    } else {
      sql = `
        SELECT SUBSTRING(mes, 1, 4) as ano,
               CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
               SUM(fat) as fat, SUM(qty) as qty
        FROM mv_vendas_mensal
        WHERE (mes >= '2025-01' AND mes <= '2026-12')
           ${filterSql}
        GROUP BY SUBSTRING(mes, 1, 4), CAST(SUBSTRING(mes, 6, 2) AS integer)
      `;
    }

    console.log(`[History Matriz API] Executing SQL:\n${sql}`);
    const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      console.error(`[History Matriz API] Query error:`, error);
      throw new Error(error.message);
    }

    const rowCount = Array.isArray(rows) ? rows.length : 0;
    console.log(`[History Matriz API] Got ${rowCount} rows from database`);
    if (rowCount > 0) {
      console.log(`[History Matriz API] First row sample:`, JSON.stringify(rows[0]));
    }

    // Helper function to get previous 3 months keys
    function getPrevious3Months(ano: number, mesNum: number): string[] {
      const dates: string[] = [];
      let currAno = ano;
      let currMes = mesNum;
      for (let i = 0; i < 3; i++) {
        currMes--;
        if (currMes === 0) {
          currMes = 12;
          currAno--;
        }
        dates.push(`${currAno}-${String(currMes).padStart(2, '0')}`);
      }
      return dates;
    }

    // Map rows in a dictionary for easy retrieval
    const dataMap: Record<string, { fat: number; qty: number }> = {};
    for (const row of (rows || [])) {
      const key = `${row.ano}-${String(row.mes_num).padStart(2, '0')}`;
      if (!dataMap[key]) {
        dataMap[key] = { fat: 0, qty: 0 };
      }
      dataMap[key].fat += Number(row.fat || 0);
      dataMap[key].qty += Number(row.qty || 0);
    }

    // Consolidate data for the 12 months using the rolling trimester average as the comparator (represented by *2025 variables)
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const currKey = `2026-${String(mNum).padStart(2, '0')}`;
      const currVal = dataMap[currKey] || { fat: 0, qty: 0 };
      
      const fat2026 = currVal.fat;
      const qty2026 = currVal.qty;
      const price2026 = qty2026 > 0 ? fat2026 / qty2026 : 0;

      // Calculate the sum of preceding 3 months
      const prevMonthsKeys = getPrevious3Months(2026, mNum);
      let sumFatPrev = 0;
      let sumQtyPrev = 0;
      for (const k of prevMonthsKeys) {
        const val = dataMap[k] || { fat: 0, qty: 0 };
        sumFatPrev += val.fat;
        sumQtyPrev += val.qty;
      }

      const prevMonthsLabels = prevMonthsKeys.map(key => {
        const m = Number(key.split("-")[1]);
        const shortMonths = [
          "jan", "fev", "mar", "abr", "mai", "jun",
          "jul", "ago", "set", "out", "nov", "dez"
        ];
        return shortMonths[m - 1];
      });

      // Calculate averages (comparative period)
      const fat2025 = sumFatPrev / 3;
      const qty2025 = sumQtyPrev / 3;
      const price2025 = qty2025 > 0 ? fat2025 / qty2025 : 0;

      // Variations
      const fatVar = fat2025 > 0 ? ((fat2026 - fat2025) / fat2025) * 100 : 0;
      const qtyVar = qty2025 > 0 ? ((qty2026 - qty2025) / qty2025) * 100 : 0;
      const priceVar = price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0;

      return {
        mesNum: mNum,
        mesLabel: MONTHS[i].slice(0, 3),
        mesFull: MONTHS[i],
        prevMonthsList: prevMonthsLabels,
        fat2025,
        qty2025,
        price2025,
        fat2026,
        qty2026,
        price2026,
        fatVar,
        qtyVar,
        priceVar,
      };
    });

    const filteredMonthsData = monthsData.filter(m => m.mesNum >= startMonth && m.mesNum <= endMonth);
    console.log(`[History Matriz API] Returning success: true. monthsData count:`, filteredMonthsData.length);
    return NextResponse.json({
      success: true,
      byMonth: filteredMonthsData,
    });
  } catch (error: unknown) {
    console.error("Dashboard history matriz API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
