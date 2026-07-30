import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth, requireApprovedProfile, requirePermission, logAuditAction, handleAuthError } from "@/lib/supabase/auth-helpers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Admin");

    // Registrar log de auditoria
    await logAuditAction(user.id, "REEXECUTE_CLIENTES_ATIVIDADE_REFRESH", "cm_clientes_atividade", {});

    const { data, error } = await supabaseAdmin.rpc("fn_trigger_refresh_clientes_atividade_manual");

    if (error) {
      console.error("[POST /api/admin/refresh-atividade] RPC Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
