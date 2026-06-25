import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { simulateTradeAction } from "@/lib/ai/prescriptive-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Authenticate user
    const supabaseNormal = await createClient();
    const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = profile?.company_id || "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";

    const body = await request.json();
    const { 
      action_type, 
      pdv_id, 
      discount_percent, 
      extra_display_investment, 
      degustation_days, 
      promotor_hours,
      recommendation_id
    } = body;

    if (!action_type || !pdv_id) {
      return NextResponse.json({ success: false, error: "Parâmetros 'action_type' e 'pdv_id' são obrigatórios." }, { status: 400 });
    }

    // 2. Fetch PDV context to establish dynamic baseline
    const { data: pdv } = await supabaseAdmin
      .from("base_atendimento")
      .select("faturamento_mensal")
      .eq("cod_parceiro", pdv_id)
      .maybeSingle();

    const { data: sellout } = await supabaseAdmin
      .from("cm_sellout_analysis")
      .select("sellout_velocity")
      .eq("pdv_id", pdv_id);

    let baselineSelloutValue = 0.00;
    sellout?.forEach(s => {
      baselineSelloutValue += Number(s.sellout_velocity || 0) * 30.0 * 60.00; // 30 days * price reference 60.00
    });

    // Fallback to 10% of monthly revenue if sellout is empty
    if (baselineSelloutValue === 0) {
      const revenue = Number(pdv?.faturamento_mensal || 0);
      baselineSelloutValue = revenue > 0 ? revenue * 0.10 : 5000.00; // default R$ 5,000.00
    }

    // 3. Run Simulation Engine
    const simResult = simulateTradeAction(action_type, {
      baselineSelloutValue,
      discount_percent,
      extra_display_investment,
      degustation_days,
      promotor_hours
    });

    // 4. Log simulation in cm_trade_action_simulation if recommendation_id is provided
    if (recommendation_id) {
      const { error: logErr } = await supabaseAdmin
        .from("cm_trade_action_simulation")
        .insert({
          recommendation_id,
          company_id: companyId,
          action_payload: {
            action_type,
            discount_percent: discount_percent || 0.0,
            extra_display_investment: extra_display_investment || 0.0,
            degustation_days: degustation_days || 0.0,
            promotor_hours: promotor_hours || 0.0
          },
          baseline_sellout: baselineSelloutValue,
          simulated_sellout: baselineSelloutValue + simResult.expected_revenue_uplift,
          sellout_uplift_percent: simResult.sellout_uplift_percent,
          estimated_revenue: simResult.expected_revenue_uplift,
          estimated_margin: simResult.expected_margin_uplift,
          estimated_cost: simResult.estimated_cost,
          estimated_roi: simResult.estimated_roi
        });

      if (logErr) {
        console.warn("Failed to log trade action simulation:", logErr);
      }
    }

    return NextResponse.json({
      success: true,
      baseline_sellout: baselineSelloutValue,
      simulation: simResult
    });

  } catch (error: any) {
    console.error("[TRADE SIMULATION API ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
