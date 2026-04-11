import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
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

    // Helper: fetch distinct values from a column with optional date filter
    async function getDistinct(column: string): Promise<string[]> {
      const allValues: string[] = [];
      let from = 0;
      const batchSize = 1000;

      while (true) {
        let query = supabase
          .from('sales')
          .select(column)
          .not(column, 'is', null);

        // Removed date filter so sidebar dropdowns always show the full global list (UF, Channels, etc.)

        const { data } = await query.range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;

        data.forEach((r) => {
          const val = (r as unknown as Record<string, unknown>)[column];
          if (val && typeof val === 'string') allValues.push(val);
        });

        if (data.length < batchSize) break;
        from += batchSize;
      }

      return [...new Set(allValues)].sort();
    }

    const [managers, ufs, channels, products, matrizes] = await Promise.all([
      getDistinct('manager'),
      getDistinct('uf'),
      getDistinct('channel'),
      getDistinct('product'),
      getDistinct('rede'),
    ]);

    const familias = ["1 KG", "5 KG", "Acessório", "Café Verde", "Cápsula", "Drip", "Geisha", "Grão", "Moído"];

    return NextResponse.json({
      success: true,
      filters: {
        managers,
        familias,
        ufs,
        channels,
        products,
        matrizes,
      },
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
