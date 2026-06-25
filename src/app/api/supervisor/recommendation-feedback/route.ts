import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
    console.error("[POST MANUAL FEEDBACK ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
