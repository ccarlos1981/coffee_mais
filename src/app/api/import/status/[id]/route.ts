import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GLOBAL_IMPORT_ROLES = ["Admin", "Admin Master", "CEO", "Trade", "Financeiro", "Diretor"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const { id } = await params;

    if (!id || id.trim() === "") {
      return NextResponse.json({ error: "Lote ID é obrigatório" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data: logEntry, error } = await adminClient
      .from("cm_sync_logs")
      .select("*")
      .eq("id", id.trim())
      .maybeSingle();

    if (error || !logEntry) {
      return NextResponse.json({ error: "Lote de importação não encontrado" }, { status: 404 });
    }

    // Ownership / Role Check
    const userRole = (profile.role || "").trim();
    const hasGlobalAccess = GLOBAL_IMPORT_ROLES.some(
      (r) => r.toLowerCase() === userRole.toLowerCase()
    );

    if (!hasGlobalAccess) {
      const logMetadata = (logEntry.metadata as Record<string, unknown>) || {};
      const uploaderId = logMetadata.user_id || logMetadata.uploaded_by;
      if (uploaderId && String(uploaderId) !== user.id) {
        return NextResponse.json(
          { success: false, error: "Acesso não autorizado a este lote de importação." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      log: logEntry,
    });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

