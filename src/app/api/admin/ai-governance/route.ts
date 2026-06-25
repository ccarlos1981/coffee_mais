import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch governance policies and version history
export async function GET(request: Request) {
  const supabaseAdmin = createAdminClient();

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

    // 1. Fetch policies
    const { getAIGovernancePolicies } = await import("@/lib/ai/governance-engine");
    const policies = await getAIGovernancePolicies(companyId);

    // 2. Fetch config version snapshots
    const { data: versions } = await supabaseAdmin
      .from("cm_kpi_config_version")
      .select("id, version, created_at, created_by, user:cm_user_profiles!created_by(id, role)")
      .eq("company_id", companyId)
      .order("version", { ascending: false });

    return NextResponse.json({
      success: true,
      policies,
      versions: versions || []
    });

  } catch (error: any) {
    console.error("[ADMIN GOVERNANCE GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST: Save or update governance policies
export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();

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
    const body = await request.json();

    // Support single policy update payload: { policy_key, policy_value }
    // Or bulk update: { policies: { key: value, ... } }
    if (body.policy_key) {
      const { error: err } = await supabaseAdmin
        .from("cm_ai_governance_policy")
        .upsert({
          company_id: companyId,
          policy_key: body.policy_key,
          policy_value: body.policy_value,
          updated_at: new Date().toISOString()
        }, { onConflict: "company_id, policy_key" });
      if (err) throw err;
    } else if (body.policies && typeof body.policies === "object") {
      for (const [key, val] of Object.entries(body.policies)) {
        const { error: err } = await supabaseAdmin
          .from("cm_ai_governance_policy")
          .upsert({
            company_id: companyId,
            policy_key: key,
            policy_value: val,
            updated_at: new Date().toISOString()
          }, { onConflict: "company_id, policy_key" });
        if (err) throw err;
      }
    } else {
      return NextResponse.json({ success: false, error: "Formato de payload inválido." }, { status: 400 });
    }

    // Trigger config snapshot versioning
    const { saveConfigVersionSnapshot } = await import("@/lib/ai/governance-engine");
    await saveConfigVersionSnapshot(companyId, user.id);

    return NextResponse.json({
      success: true,
      message: "Políticas de governança atualizadas com sucesso."
    });

  } catch (error: any) {
    console.error("[ADMIN GOVERNANCE POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
