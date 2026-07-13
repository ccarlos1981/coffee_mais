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

    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({ error: "batchId é obrigatório" }, { status: 400 });
    }

    // Registrar log de auditoria
    await logAuditAction(user.id, "ROLLBACK_IMPORT", "cm_sync_logs", { batchId });

    const result = await ImportService.rollbackImport(batchId);

    return NextResponse.json(result);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
