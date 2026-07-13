import { NextRequest, NextResponse } from "next/server";
import { ImportService } from "@/lib/services/import-service";
import { requireAuth, requireApprovedProfile, requirePermission, logAuditAction, handleAuthError } from "@/lib/supabase/auth-helpers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Método não permitido" }, { status: 405 });
  }

  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Upload");

    const { batchId, mode } = await request.json();

    if (!batchId || !mode) {
      return NextResponse.json({ error: "batchId e mode ('replace' | 'append') são obrigatórios" }, { status: 400 });
    }

    // Registrar log de auditoria
    await logAuditAction(user.id, "CONFIRM_IMPORT", "cm_sync_logs", { batchId, mode });

    const result = await ImportService.confirmImport(batchId, mode);

    return NextResponse.json(result);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
