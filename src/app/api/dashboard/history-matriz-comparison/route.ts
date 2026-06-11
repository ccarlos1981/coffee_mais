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
    const hasMatrizFilter = filters.matriz && filters.matriz !== 'all' && filters.matriz.length > 0;

    const supabase = getSupabaseClient();

    // Build common filter SQL (excluding matriz for top10 mode since we group by it)
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

    const tableName = hasProductFilter ? 'mv_positivacao_sku_mensal' : 'mv_vendas_mensal';

    if (hasProductFilter) {
      filterSql += ` AND product IN (${filters.product!.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }

    if (hasMatrizFilter) {
      // ──── MODE: MONTHLY (specific matrix selected) ────
      filterSql += ` AND rede IN (${filters.matriz!.split(',').map(m => escapeSqlValue(m)).join(',')})`;

      const sql = `
        SELECT SUBSTRING(mes, 1, 4) as ano,
               CAST(SUBSTRING(mes, 6, 2) AS integer) as mes_num,
               SUM(fat) as fat, SUM(qty) as qty
        FROM ${tableName}
        WHERE ((mes >= '2025-${startMonthStr}' AND mes <= '2025-${endMonthStr}')
           OR (mes >= '2026-${startMonthStr}' AND mes <= '2026-${endMonthStr}'))
           ${filterSql}
        GROUP BY SUBSTRING(mes, 1, 4), CAST(SUBSTRING(mes, 6, 2) AS integer)
      `;

      console.log(`[History Matriz Comparison API] Monthly mode SQL`);
      const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

      if (error) throw new Error(error.message);

      // Build monthly data
      const monthsData = Array.from({ length: 12 }, (_, i) => ({
        mesNum: i + 1,
        mesLabel: MONTHS[i].slice(0, 3),
        mesFull: MONTHS[i],
        fat2025: 0, qty2025: 0, price2025: 0,
        fat2026: 0, qty2026: 0, price2026: 0,
        fatVar: 0, qtyVar: 0, priceVar: 0,
      }));

      for (const row of (rows || [])) {
        const monthIndex = Number(row.mes_num) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          const fat = Number(row.fat || 0);
          const qty = Number(row.qty || 0);
          if (row.ano === '2025') {
            monthsData[monthIndex].fat2025 += fat;
            monthsData[monthIndex].qty2025 += qty;
          }
          if (row.ano === '2026') {
            monthsData[monthIndex].fat2026 += fat;
            monthsData[monthIndex].qty2026 += qty;
          }
        }
      }

      for (const m of monthsData) {
        m.price2025 = m.qty2025 > 0 ? m.fat2025 / m.qty2025 : 0;
        m.price2026 = m.qty2026 > 0 ? m.fat2026 / m.qty2026 : 0;
        m.fatVar = m.fat2025 > 0 ? ((m.fat2026 - m.fat2025) / m.fat2025) * 100 : 0;
        m.qtyVar = m.qty2025 > 0 ? ((m.qty2026 - m.qty2025) / m.qty2025) * 100 : 0;
        m.priceVar = m.price2025 > 0 ? ((m.price2026 - m.price2025) / m.price2025) * 100 : 0;
      }

      const filtered = monthsData.filter(m => m.mesNum >= startMonth && m.mesNum <= endMonth);

      return NextResponse.json({
        success: true,
        mode: "monthly",
        byMonth: filtered,
      });

    } else {
      // ──── MODE: TOP 10 (no specific matrix selected) ────
      const sql = `
        SELECT SUBSTRING(mes, 1, 4) as ano,
               COALESCE(rede, 'Não Mapeado') as matriz,
               SUM(fat) as fat, SUM(qty) as qty
        FROM ${tableName}
        WHERE ((mes >= '2025-${startMonthStr}' AND mes <= '2025-${endMonthStr}')
           OR (mes >= '2026-${startMonthStr}' AND mes <= '2026-${endMonthStr}'))
           ${filterSql}
        GROUP BY SUBSTRING(mes, 1, 4), COALESCE(rede, 'Não Mapeado')
      `;

      console.log(`[History Matriz Comparison API] Top10 mode SQL`);
      const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

      if (error) throw new Error(error.message);

      // Aggregate by matriz
      const matrizMap = new Map<string, {
        matriz: string;
        qty2025: number; qty2026: number;
        fat2025: number; fat2026: number;
      }>();

      for (const row of (rows || [])) {
        const matrizName = row.matriz as string;
        if (!matrizMap.has(matrizName)) {
          matrizMap.set(matrizName, {
            matriz: matrizName,
            qty2025: 0, qty2026: 0,
            fat2025: 0, fat2026: 0,
          });
        }
        const entry = matrizMap.get(matrizName)!;
        const fat = Number(row.fat || 0);
        const qty = Number(row.qty || 0);

        if (row.ano === '2025') {
          entry.qty2025 += qty;
          entry.fat2025 += fat;
        }
        if (row.ano === '2026') {
          entry.qty2026 += qty;
          entry.fat2026 += fat;
        }
      }

      // Convert to array, calculate variations, sort by total volume (2025+2026), take top 10
      const byMatriz = Array.from(matrizMap.values())
        .map(m => {
          const totalQty = m.qty2025 + m.qty2026;
          const price2025 = m.qty2025 > 0 ? m.fat2025 / m.qty2025 : 0;
          const price2026 = m.qty2026 > 0 ? m.fat2026 / m.qty2026 : 0;
          return {
            ...m,
            totalQty,
            price2025,
            price2026,
            qtyVar: m.qty2025 > 0 ? ((m.qty2026 - m.qty2025) / m.qty2025) * 100 : 0,
            fatVar: m.fat2025 > 0 ? ((m.fat2026 - m.fat2025) / m.fat2025) * 100 : 0,
            priceVar: price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0,
          };
        })
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 10)
        .map(({ totalQty, ...rest }) => rest);

      return NextResponse.json({
        success: true,
        mode: "top10",
        byMatriz,
      });
    }
  } catch (error: unknown) {
    console.error("History Matriz Comparison API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
