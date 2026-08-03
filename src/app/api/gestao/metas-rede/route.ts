import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/gestao/metas-rede
 * Simple, fast approach:
 * 1. Get planejaveis redes (deduplicated)
 * 2. Get billing per month (1 query per month, ~20k rows each)
 * 3. Aggregate billing by REDE (uppercase)
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const year = 2026;
  const months = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"];

  try {
    // 1. Planejaveis redes
    const { data: rp } = await supabase
      .from("vw_redes_planejaveis_oficiais")
      .select("rede, manager")
      .eq("is_rede_planejavel", true);

    // Deduplicate
    const seen = new Set<string>();
    const planRedes: { rede: string; manager: string }[] = [];
    (rp || []).forEach((r: any) => {
      const mgr = (r.manager || "").trim();
      const rede = (r.rede || "").trim();
      if (!rede) return;
      const k = `${mgr}|${rede}`;
      if (!seen.has(k)) { seen.add(k); planRedes.push({ rede, manager: mgr }); }
    });

    // 2. Billing by REDE (uppercase) — 1 query per month
    const billing: Record<string, Record<string, { fat: number; qty: number }>> = {};

    for (const mes of months) {
      const { data, error } = await supabase
        .from("mv_vendas_cliente_mensal")
        .select("rede, fat, qty")
        .eq("mes", mes)
        .not("rede", "is", null)
        .limit(50000);

      if (error) { console.error(`billing ${mes}:`, error); continue; }

      (data || []).forEach((row: any) => {
        const rede = (row.rede || "").trim().toUpperCase();
        if (!rede || rede === "NÃO MAPEADO") return;
        if (!billing[rede]) billing[rede] = {};
        if (!billing[rede][mes]) billing[rede][mes] = { fat: 0, qty: 0 };
        billing[rede][mes].fat += Number(row.fat) || 0;
        billing[rede][mes].qty += Number(row.qty) || 0;
      });
    }

    // 3. META targets (August)
    const { data: metaData } = await supabase
      .from("cm_weekly_projections")
      .select("manager, client_matrix, value")
      .eq("kpi", "META").eq("year", year).eq("month", 8)
      .neq("client_matrix", "_TOTAL_");

    const { data: mgrMetas } = await supabase
      .from("cm_weekly_projections")
      .select("manager, value")
      .eq("kpi", "META").eq("client_matrix", "_TOTAL_")
      .eq("year", year).eq("month", 8);

    return NextResponse.json({ planRedes, billing, metas: metaData || [], managerMetas: mgrMetas || [], months });
  } catch (e: any) {
    console.error("metas-rede error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
