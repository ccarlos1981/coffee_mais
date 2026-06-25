import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch recommendations with filters
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

    // Dynamic generation trigger
    const pdvIdParam = searchParams.get("pdv_id");
    const generateParam = searchParams.get("generate");
    if (generateParam === "true" && pdvIdParam) {
      const { generateNextBestActions } = await import("@/lib/ai/prescriptive-engine");
      await generateNextBestActions(pdvIdParam, companyId);
    }

    // 2. Build Query
    let query = supabaseAdmin
      .from("cm_ai_recommendation")
      .select("*")
      .eq("company_id", companyId);

    // Apply filters
    const status = searchParams.get("status");
    if (status) {
      query = query.eq("status", status);
    }

    const pdvId = searchParams.get("pdv_id");
    if (pdvId) {
      query = query.eq("entity_id", pdvId).eq("entity_type", "PDV");
    }

    const sku = searchParams.get("sku");
    if (sku) {
      query = query.like("recommended_action->>target_sku", `%${sku}%`);
    }

    const promoterId = searchParams.get("promoter");
    if (promoterId) {
      query = query.eq("assigned_user_id", promoterId);
    }

    const region = searchParams.get("region");
    if (region) {
      const { data: pdvs } = await supabaseAdmin
        .from("base_atendimento")
        .select("cod_parceiro")
        .eq("regional", region)
        .eq("company_id", companyId);
      const pdvIds = pdvs?.map(p => p.cod_parceiro) || [];
      query = query.in("entity_id", pdvIds).eq("entity_type", "PDV");
    }

    const { data: recs, error: queryErr } = await query.order("priority_score", { ascending: false });
    if (queryErr) throw queryErr;

    // Fetch PDV details and map them to recommendations in memory
    const pdvIdsToFetch = Array.from(new Set(recs?.filter(r => r.entity_type === "PDV").map(r => r.entity_id) || []));
    const pdvMap: Record<string, any> = {};

    if (pdvIdsToFetch.length > 0) {
      const { data: pdvs } = await supabaseAdmin
        .from("base_atendimento")
        .select("cod_parceiro, nome_parceiro, nome_fantasia, regional, uf, canal")
        .in("cod_parceiro", pdvIdsToFetch);

      if (pdvs) {
        pdvs.forEach(p => {
          pdvMap[p.cod_parceiro] = p;
        });
      }
    }

    const mappedRecs = (recs || []).map(r => ({
      ...r,
      pdv: r.entity_type === "PDV" ? pdvMap[r.entity_id] || null : null
    }));

    // Fetch Feedback loop details
    const recommendationIds = mappedRecs.map(r => r.id);
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

    const finalRecs = mappedRecs.map(r => {
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
    console.error("[GET RECOMMENDATIONS API ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// PATCH: Supervisor Approve/Reject recommendation
export async function PATCH(request: Request) {
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
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(profile?.role || "");
    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Acesso negado: Perfil não autorizado." }, { status: 403 });
    }

    const companyId = profile?.company_id || "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";
    const body = await request.json();
    const { recommendation_id, approval_status, override_reason } = body;

    if (!recommendation_id || !approval_status) {
      return NextResponse.json(
        { success: false, error: "Parâmetros 'recommendation_id' e 'approval_status' são obrigatórios." },
        { status: 400 }
      );
    }

    if (!["APPROVED", "REJECTED"].includes(approval_status)) {
      return NextResponse.json(
        { success: false, error: "O status de aprovação deve ser 'APPROVED' ou 'REJECTED'." },
        { status: 400 }
      );
    }

    if (approval_status === "REJECTED" && (!override_reason || override_reason.trim() === "")) {
      return NextResponse.json(
        { success: false, error: "Justificativa ('override_reason') é obrigatória ao rejeitar uma recomendação." },
        { status: 400 }
      );
    }

    // Update recommendation status
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("cm_ai_recommendation")
      .update({
        approval_status,
        requires_approval: false,
        override_reason: approval_status === "REJECTED" ? override_reason : null,
        status: approval_status === "REJECTED" ? "DISMISSED" : "OPEN"
      })
      .eq("id", recommendation_id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (updateErr || !updated) {
      throw new Error("Erro ao atualizar recomendação ou recomendação não encontrada.");
    }

    // Audit log update
    await supabaseAdmin.from("cm_ai_decision_log").insert({
      company_id: companyId,
      decision_type: updated.recommendation_type,
      input_payload: { recommendation_id },
      decision_payload: { approved: approval_status === "APPROVED", reason: approval_status === "APPROVED" ? "Aprovado por supervisor" : `Rejeitado por supervisor: ${override_reason}` },
      model_confidence: updated.recommendation_confidence,
      approved_by_human: approval_status === "APPROVED"
    });

    // Trigger governance alerts evaluation
    try {
      const { evaluateGovernanceAlerts } = await import("@/lib/ai/governance-engine");
      await evaluateGovernanceAlerts(companyId);
    } catch (alertErr) {
      console.error("Alert evaluation error:", alertErr);
    }

    return NextResponse.json({
      success: true,
      message: `Recomendação ${approval_status === "APPROVED" ? "aprovada" : "rejeitada"} com sucesso.`,
      recommendation: updated
    });

  } catch (error: any) {
    console.error("[PATCH RECOMMENDATION ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST: Recommendation feedback loop (executed/dismissed)
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
    console.error("[POST RECOMMENDATION FEEDBACK ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
