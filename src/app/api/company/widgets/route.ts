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

    // 2. Fetch user profile company mapping
    const { data: profile } = await supabaseNormal
      .from("cm_user_profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    const companyId = profile?.company_id || "e143e8d6-c7d7-4315-8f54-aa12ce554d2d";

    // 3. Fetch active dashboard widgets ordered by widget_order
    const { data: widgets, error: dbError } = await supabaseAdmin
      .from("cm_dashboard_widget_config")
      .select("widget_key, widget_order, is_enabled")
      .eq("company_id", companyId)
      .eq("is_enabled", true)
      .order("widget_order", { ascending: true });

    if (dbError) throw dbError;

    // Fallback default widgets if none are configured in database
    let activeWidgets = widgets || [];
    if (activeWidgets.length === 0) {
      activeWidgets = [
        { widget_key: "operacional", widget_order: 1, is_enabled: true },
        { widget_key: "investigativa", widget_order: 2, is_enabled: true },
        { widget_key: "executiva", widget_order: 3, is_enabled: true },
        { widget_key: "ai_vision", widget_order: 4, is_enabled: true },
        { widget_key: "route_intelligence", widget_order: 5, is_enabled: true }
      ];
    }

    return NextResponse.json({
      success: true,
      company_id: companyId,
      widgets: activeWidgets
    });

  } catch (error: any) {
    console.error("[COMPANY WIDGETS API ERROR]", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
