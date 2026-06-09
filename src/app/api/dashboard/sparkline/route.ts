import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
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

/**
 * Returns monthly totals (fat, qty, maco) for the last N months
 * Used for sparkline charts in the KPI cards
 * Now uses mv_vendas_mensal materialized view
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const months = parseInt(searchParams.get("months") || "6");

  const supabase = getSupabaseClient();

  // Compute start and end month keys
  const dStart = new Date(year, month - 1 - (months - 1), 1);
  const startMonth = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}`;
  const endMonth = `${year}-${String(month).padStart(2, "0")}`;

  console.log(`[Sparkline API] MV query: ${startMonth} to ${endMonth}`);

  const { data, error } = await supabase
    .from('mv_vendas_mensal')
    .select('mes, fat, qty, maco')
    .gte('mes', startMonth)
    .lte('mes', endMonth)
    .limit(10000);

  if (error) {
    console.error(`Sparkline query error:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Aggregate by month (MV has multiple rows per month due to dimensions)
  const monthlyMap = new Map<string, { fat: number; qty: number; maco: number }>();
  if (data) {
    for (const row of data) {
      const existing = monthlyMap.get(row.mes) || { fat: 0, qty: 0, maco: 0 };
      existing.fat += Number(row.fat || 0);
      existing.qty += Number(row.qty || 0);
      existing.maco += Number(row.maco || 0);
      monthlyMap.set(row.mes, existing);
    }
  }

  const monthlyData: { label: string; fat: number; qty: number; maco: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const shortLabel = `${String(m).padStart(2, "0")}/${String(y).slice(2)}`;

    const val = monthlyMap.get(monthKey) || { fat: 0, qty: 0, maco: 0 };
    monthlyData.push({
      label: shortLabel,
      fat: val.fat,
      qty: val.qty,
      maco: val.maco,
    });
  }

  return NextResponse.json({ success: true, data: monthlyData });
}
