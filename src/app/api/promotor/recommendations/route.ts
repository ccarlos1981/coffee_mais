import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch recommendations for a specific PDV (active for the promotor)
export async function GET(request: Request) {
  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(request.url);

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

    const pdvId = searchParams.get("pdv_id");
    if (!pdvId) {
      return NextResponse.json({ success: false, error: "O parâmetro 'pdv_id' é obrigatório." }, { status: 400 });
    }

    // 2. Build Query
    let query = supabaseAdmin
      .from("cm_ai_recommendation")
      .select("*")
      .eq("company_id", companyId)
      .eq("entity_id", pdvId)
      .eq("entity_type", "PDV")
      .eq("requires_approval", false)
      .eq("approval_status", "APPROVED");

    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }

    const { data: recs, error: queryErr } = await query.order("priority_score", { ascending: false });
    if (queryErr) throw queryErr;

    // Fetch Feedback loop details
    const recommendationIds = (recs || []).map(r => r.id);
    const feedbackMap: Record<string, any> = {};
    if (recommendationIds.length > 0) {
      const { data: feedbacks } = await supabaseAdmin
        .from("cm_ai_recommendation_feedback")
        .select("*")
        .in("recommendation_id", recommendationIds);

      if (feedbacks) {
        feedbacks.forEach(f => {
          feedbackMap[f.recommendation_id] = f;
        });
      }
    }

    // Fetch model performances to get historical accuracy
    const { data: performances } = await supabaseAdmin
      .from("cm_ai_model_performance")
      .select("recommendation_type, model_confidence_score")
      .eq("company_id", companyId);

    const perfMap = new Map<string, number>();
    performances?.forEach(p => {
      perfMap.set(p.recommendation_type, Number(p.model_confidence_score));
    });

    const finalRecs = (recs || []).map(r => {
      const fb = feedbackMap[r.id] || null;
      const modelConfidence = perfMap.has(r.recommendation_type) ? perfMap.get(r.recommendation_type)! : 100.00;
      return {
        ...r,
        historical_accuracy: modelConfidence,
        executed_by: fb?.executed_by || null,
        executed_at: fb?.executed_at || null,
        execution_feedback: fb ? { rating: fb.feedback_rating, notes: fb.feedback_notes, submitted_at: fb.executed_at } : null
      };
    });

    return NextResponse.json({
      success: true,
      recommendations: finalRecs
    });

  } catch (error: any) {
    console.error("[GET PROMOTER RECOMMENDATIONS API ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST: Register execution feedback from promotor app
export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Authenticate user
    const supabaseNormal = await createClient();
    const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    const body = await request.json();
    const { recommendation_id, status, feedback_notes, feedback_rating } = body;

    if (!recommendation_id || !status) {
      return NextResponse.json({ success: false, error: "Parâmetros 'recommendation_id' e 'status' são obrigatórios." }, { status: 400 });
    }

    if (!["EXECUTED", "DISMISSED"].includes(status)) {
      return NextResponse.json({ success: false, error: "O status deve ser 'EXECUTED' ou 'DISMISSED'." }, { status: 400 });
    }

    // 2. Fetch recommendation to get company_id
    const { data: rec, error: recErr } = await supabaseAdmin
      .from("cm_ai_recommendation")
      .select("company_id")
      .eq("id", recommendation_id)
      .single();
    if (recErr || !rec) throw new Error("Recomendação não encontrada.");

    // 3. Insert/upsert into feedback table
    const { data: fb, error: fbErr } = await supabaseAdmin
      .from("cm_ai_recommendation_feedback")
      .upsert({
        recommendation_id,
        status,
        feedback_rating: Number(feedback_rating || 5),
        feedback_notes: feedback_notes || "",
        executed_by: user.id,
        executed_at: new Date().toISOString(),
        company_id: rec.company_id
      }, { onConflict: "recommendation_id" })
      .select()
      .single();
    if (fbErr) throw fbErr;

    // 4. Update status in recommendations
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("cm_ai_recommendation")
      .update({ status })
      .eq("id", recommendation_id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    if (status === "EXECUTED") {
      const { evaluateExecutedRecommendation } = await import("@/lib/ai/learning-engine");
      await evaluateExecutedRecommendation(recommendation_id, "MANUAL");
    }

    return NextResponse.json({
      success: true,
      message: "Feedback de recomendação registrado com sucesso.",
      recommendation: {
        ...updated,
        executed_by: fb.executed_by,
        executed_at: fb.executed_at,
        execution_feedback: {
          rating: fb.feedback_rating,
          notes: fb.feedback_notes,
          submitted_at: fb.executed_at
        }
      }
    });

  } catch (error: any) {
    console.error("[POST PROMOTER RECOMMENDATION FEEDBACK ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
