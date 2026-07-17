import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleProcessQueue(request: Request) {
  const authHeader = request.headers.get("authorization");
  const isCronSecretValid = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // If cron secret is not used/valid, authenticate using session cookie
  if (!isCronSecretValid) {
    try {
      const supabaseNormal = await createClient();
      const { data: { user }, error: authError } = await supabaseNormal.auth.getUser();
      
      if (authError || !user) {
        return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
      }

      // Check authorization
      const { data: profile } = await supabaseNormal
        .from("cm_user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(profile?.role || "");
      if (!isAuthorized) {
        return NextResponse.json({ success: false, error: "Acesso negado: Perfil não autorizado." }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ success: false, error: "Erro de autorização." }, { status: 403 });
    }
  }

  // If authorized, run the process queue RPC
  try {
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
  } catch (err: any) {
    console.error("[process-mv-queue] API error:", err);
    return NextResponse.json({ success: false, error: err.message || "Erro interno do servidor." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleProcessQueue(request);
}

export async function POST(request: Request) {
  return handleProcessQueue(request);
}
