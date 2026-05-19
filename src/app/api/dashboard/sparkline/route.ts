import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Returns monthly totals (fat, qty, maco) for the last N months
 * Used for sparkline charts in the KPI cards
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const months = parseInt(searchParams.get("months") || "6");

  const supabase = getSupabaseClient();

  // Build list of month ranges to query
  const monthlyData: { label: string; fat: number; qty: number; maco: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 0).toISOString().split("T")[0];
    const shortLabel = `${String(m).padStart(2, "0")}/${String(y).slice(2)}`;

    const { data, error } = await supabase.rpc("execute_readonly_query", {
      query_text: `WITH sales_enriched AS (
      SELECT 
        b.manager, 
        b.rede, 
        f.nome_parceiro, 
        f.desc_produto as product, 
        f.dt_faturamento as invoice_date, 
        COALESCE(CAST(f.vlr_total_liq AS numeric), 0) as net_value,
        COALESCE(CAST(f.quantidade AS numeric), 0) as quantity,
        (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0)) as imposto,
        COALESCE(CAST(f.custo_total AS numeric), 0) as custo_total,
        COALESCE(CAST(f.vlr_frete AS numeric), 0) as custo_frete,
        0 as receita_frete
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    )
    SELECT
        COALESCE(SUM(net_value::numeric), 0) as fat,
        COALESCE(SUM(quantity::numeric), 0) as qty,
        COALESCE(SUM(net_value::numeric - imposto::numeric - custo_total::numeric - custo_frete::numeric + receita_frete::numeric), 0) as maco
      FROM sales_enriched
      WHERE invoice_date >= '${startDate}' AND invoice_date <= '${endDate}' AND manager IS NOT NULL`,
    });

    if (error) {
      console.error(`Sparkline query error for ${shortLabel}:`, error);
      monthlyData.push({ label: shortLabel, fat: 0, qty: 0, maco: 0 });
    } else {
      const row = data?.[0] || {};
      monthlyData.push({
        label: shortLabel,
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
        maco: Number(row.maco || 0),
      });
    }
  }

  return NextResponse.json({ success: true, data: monthlyData });
}
