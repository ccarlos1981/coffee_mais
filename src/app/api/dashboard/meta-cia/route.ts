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

/**
 * Meta CIA — monthly totals by channel for a given year
 * Now uses mv_vendas_mensal materialized view
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const type = searchParams.get("type") || "revenue";

    const startMonth = `${year}-01`;
    const endMonth = `${year}-12`;

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('mv_vendas_mensal')
      .select('mes_num, channel, fat, qty')
      .eq('ano', String(year))
      .gte('mes', startMonth)
      .lte('mes', endMonth)
      .limit(10000);

    if (error) {
      throw new Error(error.message);
    }

    // Aggregate by month+channel
    const combined: { month: number; channel: string; amount: number }[] = [];
    const monthChannelMap = new Map<string, number>();
    const monthTotalMap = new Map<number, number>();

    for (const row of (data || [])) {
      const monthNum = Number(row.mes_num);
      const channel = row.channel || 'Outros';
      const value = type === "qty" ? Number(row.qty || 0) : Number(row.fat || 0);

      // Channel level
      const key = `${monthNum}-${channel}`;
      monthChannelMap.set(key, (monthChannelMap.get(key) || 0) + value);

      // Total level
      monthTotalMap.set(monthNum, (monthTotalMap.get(monthNum) || 0) + value);
    }

    // Build "Todos" (totals) rows
    for (const [month, amount] of monthTotalMap) {
      combined.push({ month, channel: 'Todos', amount });
    }

    // Build channel rows
    for (const [key, amount] of monthChannelMap) {
      const [monthStr, channel] = key.split('-');
      combined.push({ month: parseInt(monthStr), channel, amount });
    }

    // Sort by channel then month
    combined.sort((a, b) => {
      if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
      return a.month - b.month;
    });

    return NextResponse.json({ success: true, data: combined });
  } catch (error: any) {
    console.error("Dashboard acomp-anual API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
