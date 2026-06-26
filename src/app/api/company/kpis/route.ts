import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateCompanyScore } from "@/lib/ai/configurable-kpi-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Authenticate user
    const supabaseNormal = await createClient();
    const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // 2. Fetch user profile company mapping
    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    // Default fallback to Coffee Mais company ID
    const companyId = profile?.company_id || "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";

    // 3. Gather active raw metrics from Database (with fallback defaults)
    let rawRuptureRate = 0.08; // 8%
    const rawPriceGap = 0.04;    // 4%
    const rawSelloutVelocity = 6.5; // 6.5 boxes/day
    let rawCoverageRate = 0.78; // 78%
    let rawShareOfShelf = 0.38; // 38%
    const rawConversionRate = 0.65; // 65%

    // Query rupture rate
    try {
      const { data: selloutData } = await supabaseAdmin
        .from("cm_sellout_analysis")
        .select(`
          stock_risk,
          pdv:base_atendimento!inner(
            company_id
          )
        `)
        .eq("base_atendimento.company_id", companyId);
      if (selloutData && selloutData.length > 0) {
        const atRiskCount = selloutData.filter((s: any) => ["CRITICAL", "HIGH"].includes(s.stock_risk)).length;
        rawRuptureRate = atRiskCount / selloutData.length;
      }
    } catch (e) {
      console.warn("Could not calculate dynamic rupture rate, using default.", e);
    }

    // Query shelf share
    try {
      const { data: shelfData } = await supabaseAdmin
        .from("cm_ai_shelf_analysis")
        .select(`
          shelf_share_percent,
          visita:cm_promotor_visita!inner(
            pdv:base_atendimento!inner(
              company_id
            )
          )
        `)
        .eq("cm_promotor_visita.base_atendimento.company_id", companyId)
        .eq("analysis_status", "DONE")
        .limit(10);
      if (shelfData && shelfData.length > 0) {
        const sum = shelfData.reduce((acc, curr: any) => acc + Number(curr.shelf_share_percent || 0.0), 0);
        rawShareOfShelf = (sum / shelfData.length) / 100.0; // convert to ratio [0, 1]
      }
    } catch (e) {
      console.warn("Could not calculate dynamic shelf share, using default.", e);
    }

    // Query coverage rate (visits)
    try {
      const { data: visits } = await supabaseAdmin
        .from("cm_promotor_visita")
        .select(`
          status,
          pdv:base_atendimento!inner(
            company_id
          )
        `)
        .eq("base_atendimento.company_id", companyId)
        .limit(50);
      if (visits && visits.length > 0) {
        const completed = visits.filter((v: any) => v.status === "CONCLUIDA").length;
        rawCoverageRate = completed / visits.length;
      }
    } catch (e) {
      console.warn("Could not calculate dynamic coverage rate, using default.", e);
    }

    const entityData = {
      rupture_rate: rawRuptureRate,
      price_gap: rawPriceGap,
      sellout_velocity: rawSelloutVelocity,
      coverage_rate: rawCoverageRate,
      share_of_shelf: rawShareOfShelf,
      conversion_rate: rawConversionRate
    };

    // 4. Run calculation engine
    const scoreResult = await calculateCompanyScore(companyId, entityData);

    return NextResponse.json({
      success: true,
      company_id: companyId,
      raw_metrics: entityData,
      data: scoreResult
    });

  } catch (error: any) {
    console.error("[COMPANY KPIS API ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
