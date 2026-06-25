import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch decision audit logs with filters
export async function GET(request: Request) {
  const supabaseAdmin = createAdminClient();
  const { searchParams } = new URL(request.url);

  try {
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

    // Build Query
    let query = supabaseAdmin
      .from("cm_ai_decision_log")
      .select("*")
      .eq("company_id", companyId);

    // Apply Filters
    const decisionType = searchParams.get("decision_type");
    if (decisionType && decisionType !== "TODOS") {
      query = query.eq("decision_type", decisionType);
    }

    const approved = searchParams.get("approved");
    if (approved === "true") {
      query = query.eq("decision_payload->>approved", "true");
    } else if (approved === "false") {
      query = query.eq("decision_payload->>approved", "false");
    }

    const minConfidence = searchParams.get("min_confidence");
    if (minConfidence) {
      query = query.gte("model_confidence", Number(minConfidence));
    }

    const maxConfidence = searchParams.get("max_confidence");
    if (maxConfidence) {
      query = query.lte("model_confidence", Number(maxConfidence));
    }

    const startDate = searchParams.get("start_date");
    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    const endDate = searchParams.get("end_date");
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data: logs, error: queryErr } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryErr) throw queryErr;

    return NextResponse.json({
      success: true,
      logs: logs || []
    });

  } catch (error: any) {
    console.error("[DECISION LOG GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
