import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requireRole, assertPdvAccess, assertPromotorAccess, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ["CEO", "Admin", "Admin Master", "Trade", "Supervisor", "Promotor"]);

    const supabaseAdmin = createAdminClient();
    const body = await request.json();
    const { recommendation_id, feedback_rating, notes } = body;

    if (!recommendation_id || !feedback_rating) {
      return NextResponse.json({ success: false, error: "Parâmetros 'recommendation_id' e 'feedback_rating' são obrigatórios." }, { status: 400 });
    }

    // 2. Fetch recommendation
    const { data: rec, error: recErr } = await supabaseAdmin
      .from("cm_ai_recommendation")
      .select("*")
      .eq("id", recommendation_id)
      .single();

    if (recErr || !rec) {
      return NextResponse.json({ success: false, error: "Recomendação não encontrada." }, { status: 404 });
    }

    // ACH-W15-NEW-13: Validação de escopo por entity_type
    const NATIONAL_ROLES = new Set(["admin", "admin master", "ceo", "trade"]);
    const currentRole = (profile.role || "").toLowerCase();

    if (!NATIONAL_ROLES.has(currentRole)) {
      if (rec.assigned_user_id && rec.assigned_user_id === user.id) {
        // Usuário designado tem autorização direta para enviar feedback
      } else if (rec.entity_type === "PDV") {
        await assertPdvAccess(user.id, profile, rec.entity_id);
      } else if (rec.entity_type === "PROMOTOR") {
        await assertPromotorAccess(user.id, profile, rec.entity_id);
      } else if (rec.entity_type === "REGION") {
        const userRegional = profile.manager_name || profile.name;
        if (!userRegional || rec.entity_id.toUpperCase() !== userRegional.toUpperCase()) {
          return NextResponse.json({ success: false, error: "Acesso negado: Recomendação fora da sua regional." }, { status: 403 });
        }
      } else {
        // Tipos não mapeados (SKU / DISTRIBUTOR / etc) -> Fail closed
        return NextResponse.json({ success: false, error: "Acesso negado para este tipo de recomendação." }, { status: 403 });
      }
    }

    // 3. Upsert into feedback table
    const { data: fb, error: fbErr } = await supabaseAdmin
      .from("cm_ai_recommendation_feedback")
      .upsert({
        recommendation_id,
        status: "EXECUTED",
        feedback_rating: Number(feedback_rating),
        feedback_notes: notes || "",
        executed_by: user.id,
        executed_at: new Date().toISOString(),
        company_id: rec.company_id
      }, { onConflict: "recommendation_id" })
      .select()
      .single();

    if (fbErr) throw fbErr;

    // 4. Update status in recommendations table
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("cm_ai_recommendation")
      .update({ status: "EXECUTED" })
      .eq("id", recommendation_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 5. Trigger Closed-Loop Evaluation
    const { evaluateExecutedRecommendation } = await import("@/lib/ai/learning-engine");
    await evaluateExecutedRecommendation(recommendation_id, "MANUAL");

    return NextResponse.json({
      success: true,
      message: "Feedback manual registrado e aprendizado calibrado com sucesso.",
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
    if (error?.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acesso negado." }, { status: 403 });
    }
    if (error?.message === "NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Recurso não encontrado." }, { status: 404 });
    }
    console.error("[POST MANUAL FEEDBACK ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
