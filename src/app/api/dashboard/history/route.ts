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
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    let startMonth: string, endMonth: string;
    if (startStr && endStr) {
      startMonth = startStr;
      endMonth = endStr;
    } else {
      const endYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
      const startYear = endYear - 2;
      startMonth = `${startYear}-01`;
      endMonth = `${endYear}-12`;
    }

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
    };

    const investmentPct = parseFloat(searchParams.get("investment") || "0") / 100;

    console.log(`[History API] MV query: ${startMonth} to ${endMonth}`);

    const supabase = getSupabaseClient();

    // Build WHERE clause for filters
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

    // Use RPC to query MV directly — bypasses PostgREST row limit
    const sql = `
      SELECT mes, ano, tipo_produto, rede, manager,
             SUM(fat) as fat, SUM(qty) as qty,
             SUM(maco - fat * ${investmentPct}) as maco
      FROM mv_vendas_mensal
      WHERE mes >= ${escapeSqlValue(startMonth)} AND mes <= ${escapeSqlValue(endMonth)}
      ${filterSql}
      GROUP BY mes, ano, tipo_produto, rede, manager
      ORDER BY mes
    `;

    const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      console.error(`[History API] Query error:`, error);
      throw new Error(error.message);
    }

    console.log(`[History API] Got ${rows?.length || 0} MV rows`);

    // Aggregate monthly history
    const monthlyMap = new Map<string, { monthKey: string; year: string; fat: number; qty: number; maco: number }>();
    const familiaMap = new Map<string, { familia: string; fat: number; qty: number; maco: number }>();
    const clientMap = new Map<string, { client: string; fat: number; qty: number; maco: number }>();

    for (const row of (rows || [])) {
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const maco = Number(row.maco || 0);

      // Monthly
      const monthKey = row.mes;
      const existing = monthlyMap.get(monthKey) || { monthKey, year: row.ano, fat: 0, qty: 0, maco: 0 };
      existing.fat += fat;
      existing.qty += qty;
      existing.maco += maco;
      monthlyMap.set(monthKey, existing);

      // Familia
      const familia = row.tipo_produto || 'Outros';
      const existingFam = familiaMap.get(familia) || { familia, fat: 0, qty: 0, maco: 0 };
      existingFam.fat += fat;
      existingFam.qty += qty;
      existingFam.maco += maco;
      familiaMap.set(familia, existingFam);

      // Client (by rede)
      const client = row.rede || 'Não Mapeado';
      const existingClient = clientMap.get(client) || { client, fat: 0, qty: 0, maco: 0 };
      existingClient.fat += fat;
      existingClient.qty += qty;
      existingClient.maco += maco;
      clientMap.set(client, existingClient);
    }

    const monthlyHistory = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const byFamilia = Array.from(familiaMap.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);
    const byClient = Array.from(clientMap.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);

    const totalFat = monthlyHistory.reduce((s, m) => s + m.fat, 0);
    const totalQty = monthlyHistory.reduce((s, m) => s + m.qty, 0);
    const totalMaco = monthlyHistory.reduce((s, m) => s + m.maco, 0);

    console.log(`[History API] Result: ${monthlyHistory.length} months, ${byFamilia.length} familias, ${byClient.length} clients`);

    return NextResponse.json({
      success: true,
      monthlyHistory,
      byFamilia,
      byClient,
      totals: { fat: totalFat, qty: totalQty, maco: totalMaco }
    });
  } catch (error: unknown) {
    console.error("Dashboard history API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
