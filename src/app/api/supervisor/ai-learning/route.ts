import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = profile?.company_id || "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";

    // 2. Fetch performance data
    const { data: performances, error: perfErr } = await supabaseAdmin
      .from("cm_ai_model_performance")
      .select("*")
      .eq("company_id", companyId);

    if (perfErr) throw perfErr;

    // 3. Fetch active alerts
    const { data: alerts, error: alertErr } = await supabaseAdmin
      .from("cm_ai_model_alert")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_resolved", false);

    if (alertErr) throw alertErr;

    // 4. Fetch historical weights
    const { data: weightsHistory, error: weightsErr } = await supabaseAdmin
      .from("cm_ai_model_weights")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (weightsErr) throw weightsErr;

    // 5. Calculate aggregated statistics
    let model_accuracy = 100.00;
    let avg_prediction_error = 0.00;
    let best_action_type = "-";
    let worst_action_type = "-";

    if (performances && performances.length > 0) {
      const totalAccuracy = performances.reduce((sum, p) => sum + Number(p.model_confidence_score), 0);
      model_accuracy = Number((totalAccuracy / performances.length).toFixed(2));

      const totalError = performances.reduce((sum, p) => sum + Number(p.avg_prediction_error), 0);
      avg_prediction_error = Number((totalError / performances.length).toFixed(2));

      // Sort to find best/worst by realized ROI
      const sortedByRoi = [...performances].sort((a, b) => Number(b.avg_realized_roi) - Number(a.avg_realized_roi));
      best_action_type = sortedByRoi[0]?.recommendation_type || "-";
      
      const sortedByError = [...performances].sort((a, b) => Number(b.avg_prediction_error) - Number(a.avg_prediction_error));
      worst_action_type = sortedByError[0]?.recommendation_type || "-";
    }

    return NextResponse.json({
      success: true,
      model_accuracy,
      avg_prediction_error,
      best_action_type,
      worst_action_type,
      performances: performances || [],
      alerts: alerts || [],
      weights_history: weightsHistory || []
    });

  } catch (error: any) {
    console.error("[GET AI LEARNING STATS ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
