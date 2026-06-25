import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Fetch config settings
export async function GET(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Authenticate user
    const supabaseNormal = await createClient();
    const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Check authorization
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

    // 2. Fetch KPI configurations
    const { data: kpiConfigs } = await supabaseAdmin
      .from("cm_company_kpi_config")
      .select(`
        id,
        kpi_id,
        kpi_code,
        weight,
        target_value,
        warning_threshold,
        critical_threshold,
        threshold_low,
        threshold_medium,
        threshold_high,
        is_enabled,
        kpi:cm_kpi_definition!cm_company_kpi_config_kpi_id_fkey (
          kpi_key,
          kpi_code,
          display_name,
          kpi_name,
          category
        )
      `)
      .eq("company_id", companyId);

    // 3. Fetch Widget configurations
    const { data: widgets } = await supabaseAdmin
      .from("cm_dashboard_widget_config")
      .select("widget_key, widget_order, is_enabled")
      .eq("company_id", companyId)
      .order("widget_order", { ascending: true });

    // 4. Fetch use_real_ai feature flag
    const { data: realAiFlag } = await supabaseAdmin
      .from("cm_feature_flags")
      .select("is_active")
      .eq("flag_key", "use_real_ai")
      .maybeSingle();

    return NextResponse.json({
      success: true,
      company_id: companyId,
      kpis: kpiConfigs || [],
      widgets: widgets || [],
      use_real_ai: realAiFlag?.is_active || false
    });

  } catch (error: any) {
    console.error("[ADMIN KPI CONFIG GET ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST: Save config settings
export async function POST(request: Request) {
  const supabaseAdmin = createAdminClient();

  try {
    // 1. Authenticate user
    const supabaseNormal = await createClient();
    const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // Check authorization
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

    // 1.5 Validate KPI weight sum = 100% server-side
    if (body.kpis && Array.isArray(body.kpis)) {
      const { data: storedConfigs } = await supabaseAdmin
        .from("cm_company_kpi_config")
        .select("id, weight, is_enabled")
        .eq("company_id", companyId);

      const configMap = new Map<string, { weight: number; is_enabled: boolean }>();
      storedConfigs?.forEach(sc => {
        configMap.set(sc.id, { weight: Number(sc.weight), is_enabled: Boolean(sc.is_enabled) });
      });

      body.kpis.forEach((kpi: any) => {
        if (configMap.has(kpi.id)) {
          configMap.set(kpi.id, {
            weight: kpi.weight !== undefined ? Number(kpi.weight) : configMap.get(kpi.id)!.weight,
            is_enabled: kpi.is_enabled !== undefined ? Boolean(kpi.is_enabled) : configMap.get(kpi.id)!.is_enabled
          });
        }
      });

      let totalWeight = 0;
      configMap.forEach((val) => {
        if (val.is_enabled) {
          totalWeight += val.weight;
        }
      });

      if (Math.abs(totalWeight - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: `A soma dos pesos dos KPIs habilitados deve ser exatamente 100% (atual: ${totalWeight.toFixed(2)}%).` },
          { status: 400 }
        );
      }
    }

    // 2. Update KPI configs
    if (body.kpis && Array.isArray(body.kpis)) {
      for (const kpi of body.kpis) {
        const { error: err } = await supabaseAdmin
          .from("cm_company_kpi_config")
          .update({
            weight: Number(kpi.weight),
            target_value: Number(kpi.target_value),
            warning_threshold: Number(kpi.warning_threshold ?? kpi.threshold_medium ?? 0),
            critical_threshold: Number(kpi.critical_threshold ?? kpi.threshold_high ?? 0),
            threshold_low: Number(kpi.threshold_low ?? 0),
            threshold_medium: Number(kpi.threshold_medium ?? kpi.warning_threshold ?? 0),
            threshold_high: Number(kpi.threshold_high ?? kpi.critical_threshold ?? 0),
            is_enabled: Boolean(kpi.is_enabled),
            updated_at: new Date().toISOString()
          })
          .eq("id", kpi.id)
          .eq("company_id", companyId);
        if (err) throw err;
      }
    }

    // 3. Update Widget configs
    if (body.widgets && Array.isArray(body.widgets)) {
      for (const widget of body.widgets) {
        const { error: err } = await supabaseAdmin
          .from("cm_dashboard_widget_config")
          .upsert({
            company_id: companyId,
            widget_key: widget.widget_key,
            widget_order: Number(widget.widget_order),
            is_enabled: Boolean(widget.is_enabled)
          }, { onConflict: "company_id, widget_key" });
        if (err) throw err;
      }
    }

    // 4. Update use_real_ai feature flag
    if (body.use_real_ai !== undefined) {
      const { error: err } = await supabaseAdmin
        .from("cm_feature_flags")
        .upsert({
          flag_key: "use_real_ai",
          is_active: Boolean(body.use_real_ai)
        }, { onConflict: "flag_key" });
      if (err) throw err;
    }

    // 5. Version snapshot
    try {
      const { saveConfigVersionSnapshot } = await import("@/lib/ai/governance-engine");
      await saveConfigVersionSnapshot(companyId, user.id);
    } catch (snapshotErr) {
      console.error("[SNAPSHOT ERROR]", snapshotErr);
    }

    return NextResponse.json({
      success: true,
      message: "Configurações salvas com sucesso."
    });

  } catch (error: any) {
    console.error("[ADMIN KPI CONFIG POST ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
