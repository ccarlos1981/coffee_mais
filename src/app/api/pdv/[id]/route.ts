import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
  logAuditAction,
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
    const body = await request.json();
    
    const { name, network_id, erp_code, status } = body;
    const updObj: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
    
    if (name) updObj.name = name.trim();
    if (network_id !== undefined) updObj.network_id = network_id;
    if (erp_code !== undefined) updObj.erp_code = erp_code;
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
      error.message?.includes("ROLE_NOT_ALLOWED")
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
