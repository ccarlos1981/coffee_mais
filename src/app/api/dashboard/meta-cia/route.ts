import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const type = searchParams.get("type") || "revenue";

    const valueColumn = type === "qty" ? "quantity" : "net_value";

    const sql = `
    WITH sales_enriched AS (
      SELECT 
        b.manager, 
        b.rede, 
        f.nome_parceiro, 
        f.desc_produto as product, 
        f.dt_faturamento as invoice_date, 
        COALESCE(CAST(f.vlr_total_liq AS numeric), 0) as net_value,
        COALESCE(CAST(f.quantidade AS numeric), 0) as quantity,
        b.canal as channel
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    ),
    sales_filtered AS (
      SELECT 
        EXTRACT(MONTH FROM invoice_date) as month,
        channel,
        COALESCE(CAST(${valueColumn} AS numeric), 0) as net_value
      FROM sales_enriched
      WHERE EXTRACT(YEAR FROM invoice_date) = ${year} AND manager IS NOT NULL
    ),
    -- Consolidado todos os canais
    monthly_totals AS (
      SELECT 
        month,
        'Todos' as channel,
        SUM(net_value) as amount
      FROM sales_filtered
      GROUP BY month
    ),
    -- Agrupado por canal
    channel_totals AS (
      SELECT 
        month,
        channel,
        SUM(net_value) as amount
      FROM sales_filtered
      GROUP BY month, channel
    ),
    -- Union all
    combined AS (
      SELECT * FROM monthly_totals
      UNION ALL
      SELECT * FROM channel_totals WHERE channel IS NOT NULL AND channel != ''
    )
    SELECT * FROM combined ORDER BY channel, month
    `;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("Dashboard acomp-anual API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
