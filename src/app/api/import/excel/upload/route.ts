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

    // Registrar log de auditoria
    await logAuditAction(user.id, "UPLOAD_EXCEL", "cm_sync_logs");

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userEmail = formData.get("userEmail") as string || "system";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "O arquivo excede o limite máximo permitido de 50MB." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const preview = await ImportService.analyzeExcel(
      buffer,
      file.name,
      file.size,
      userEmail
    );

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
