import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertCronAccess,
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleProcessQueue(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    // Dual authorization mode: Cron Bearer Token (Constant-Time) OR Authenticated User Session
    if (authHeader) {
      const cronCheck = await assertCronAccess(request);
      if (!cronCheck.authorized) {
        return cronCheck.errorResponse!;
      }
    } else {
      const user = await requireAuth();
      const profile = await requireApprovedProfile(user.id);
      requireRole(profile, ["CEO", "Admin", "Trade", "Supervisor"]);
    }

    // If authorized, run the process queue RPC
    const supabaseAdmin = createAdminClient();
    console.log("[process-mv-queue] Running fn_process_mv_refresh_queue via RPC...");
    const { data: processed, error } = await supabaseAdmin.rpc("fn_process_mv_refresh_queue");

    if (error) {
      console.error("[process-mv-queue] RPC error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log("[process-mv-queue] RPC success. Processed status:", processed);
    return NextResponse.json({
      success: true,
      processed: !!processed,
      message: processed 
        ? "Refresh da fila executado com sucesso." 
        : "Fila sem jobs pendentes ou outro job já está em execução."
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function GET(request: Request) {
  return handleProcessQueue(request);
}

export async function POST(request: Request) {
  return handleProcessQueue(request);
}
