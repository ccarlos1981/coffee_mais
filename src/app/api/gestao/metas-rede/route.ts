import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/gestao/metas-rede
 * Returns historical billing per rede/manager (Jan-Jul 2026)
 * plus the META targets from cm_weekly_projections.
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year")) || 2026;
  // Build month keys from January to July
  const months: string[] = [];
  for (let m = 1; m <= 7; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }

  try {
    // 1. Historical billing per rede per month
    const { data: salesData, error: salesErr } = await supabase
      .from("mv_vendas_cliente_mensal")
      .select("mes, manager, rede, fat, qty")
      .in("mes", months)
      .not("rede", "is", null)
      .limit(50000);

    if (salesErr) throw salesErr;

    // 2. META targets per rede from cm_weekly_projections
    const { data: metaData, error: metaErr } = await supabase
      .from("cm_weekly_projections")
      .select("manager, client_matrix, value, month, year")
      .eq("kpi", "META")
      .eq("year", year)
      .neq("client_matrix", "_TOTAL_");

    if (metaErr) throw metaErr;

    // 3. Manager total META
    const { data: managerMetas, error: mmErr } = await supabase
      .from("cm_weekly_projections")
      .select("manager, value, month, year")
      .eq("kpi", "META")
      .eq("client_matrix", "_TOTAL_")
      .eq("year", year);

    if (mmErr) throw mmErr;

    // 4. Matrizes for gerente/canal info
    const { data: matrizes } = await supabase
      .from("v_redes_matrizes_detalhes")
      .select("nome, gerente, canal, codigo");

    return NextResponse.json({
      sales: salesData || [],
      metas: metaData || [],
      managerMetas: managerMetas || [],
      matrizes: matrizes || [],
      months,
    });
  } catch (e: any) {
    console.error("Erro metas-rede:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
