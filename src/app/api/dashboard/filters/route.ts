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
 * GET /api/dashboard/filters
 * Returns distinct values for all sidebar filters.
 * Optionally scoped by year/month via query params.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const supabase = getSupabaseClient();

    let startDate: string | null = searchParams.get('startDate');
    let endDate: string | null = searchParams.get('endDate');
    
    if (!startDate && !endDate && year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      startDate = new Date(y, m - 1, 1).toISOString().split("T")[0];
      endDate = new Date(y, m, 0).toISOString().split("T")[0];
    }

    const { data: dbFilters, error } = await supabase.rpc('get_dashboard_filters_rpc');

    if (error) throw error;

    // Query max date from cm_faturamento_sankhya to find the latest period with data
    let latestPeriod = { year: 2026, month: 5 };
    try {
      const { data: maxDateRes, error: maxDateErr } = await supabase.rpc('execute_readonly_query', {
        query_text: "SELECT max(dt_faturamento)::text as max_date FROM cm_faturamento_sankhya"
      });
      if (!maxDateErr && maxDateRes && maxDateRes.length > 0 && maxDateRes[0].max_date) {
        const maxDateStr = maxDateRes[0].max_date;
        const parts = maxDateStr.split('-');
        latestPeriod = {
          year: Number(parts[0]),
          month: Number(parts[1])
        };
      }
    } catch (e) {
      console.error("[Filters API] Error querying max date:", e);
    }

    // The RPC returns { managers: [...], ufs: [...], channels: [...], produtos: [...], familias: [...], matrizes: [...] }
    return NextResponse.json({
      success: true,
      filters: {
        managers: dbFilters.managers || [],
        familias: dbFilters.familias || ["1 KG", "5 KG", "Acessório", "Café Verde", "Cápsula", "Drip", "Geisha", "Grão", "Moído"],
        ufs: dbFilters.ufs || [],
        channels: dbFilters.channels || [],
        products: dbFilters.produtos || [],
        matrizes: dbFilters.matrizes || [],
      },
      latestPeriod,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Filters API] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
