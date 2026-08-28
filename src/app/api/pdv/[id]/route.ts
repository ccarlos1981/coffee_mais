import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
  assertPdvAccess,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, [
      "Admin",
      "Admin Master",
      "Trade",
      "Supervisor",
      "Gerente Regional",
      "CEO",
    ]);

    const supabase = getSupabaseClient();

    // 1. Obter PDV alvo para validação de escopo e identidade
    const { data: pdvAlvo, error: pdvErr } = await supabase
      .from("pdvs")
      .select("id, erp_code, network_id, name")
      .eq("id", id)
      .maybeSingle();

    if (pdvErr || !pdvAlvo) {
      return NextResponse.json({ success: false, error: "PDV não encontrado." }, { status: 404 });
    }

    // 2. Validar autorização no nível do objeto (Object-Level Authorization)
    await assertPdvAccess(user.id, profile, pdvAlvo.erp_code || pdvAlvo.id);

    const body = await request.json();
    const { name, network_id, erp_code, status } = body;

    // 3. Proteger campos estruturais contra privilege escalation (network_id, erp_code)
    const roleLower = (profile.role || "").trim().toLowerCase();
    const isTopAdminOrTrade = ["admin", "admin master", "trade", "ceo"].includes(roleLower);

    if ((network_id !== undefined || erp_code !== undefined) && !isTopAdminOrTrade) {
      return NextResponse.json(
        {
          success: false,
          error: "A alteração de rede vinculada (network_id) ou código ERP é restrita a Administradores e Trade.",
        },
        { status: 403 }
      );
    }

    const updObj: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
    
    if (name) updObj.name = name.trim();
    if (network_id !== undefined && isTopAdminOrTrade) updObj.network_id = network_id;
    if (erp_code !== undefined && isTopAdminOrTrade) updObj.erp_code = erp_code;
    if (status) updObj.status = status;

    const { data, error } = await supabase
      .from("pdvs")
      .update(updObj)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await logAuditAction(user.id, "PDV_UPDATE", "pdvs", { id, updates: updObj });

    return NextResponse.json({ success: true, pdv: data });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED") ||
      error.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[PDV API PUT]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ["Admin", "Admin Master", "CEO"]);

    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from("pdvs")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await logAuditAction(user.id, "PDV_DELETE", "pdvs", { id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED")
    ) {
      return handleAuthError(error);
    }
    console.error("[PDV API DELETE]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
