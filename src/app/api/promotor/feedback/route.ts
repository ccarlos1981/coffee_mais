import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES = [
  "GPS ruim",
  "App travou",
  "Bateria drenando",
  "Câmera falhou",
  "Sincronização lenta"
];

const ALLOWED_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Não autenticado." }, { status: 401 });
    }

    // 2. Fetch promotor profile
    const { data: perfil } = await supabase
      .from("cm_promotor_perfil")
      .select("employee_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!perfil) {
      return NextResponse.json({ success: false, error: "Perfil de promotor correspondente não encontrado." }, { status: 400 });
    }

    const employeeId = perfil.employee_id;
    const body = await request.json();

    const { category, severity, description, device_timestamp, latitude, longitude, device_info } = body;

    // Validate parameters
    if (!category || !severity || !device_timestamp) {
      return NextResponse.json({ success: false, error: "Parâmetros obrigatórios ausentes (category, severity, device_timestamp)." }, { status: 400 });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: `Categoria inválida. Valores aceitos: ${ALLOWED_CATEGORIES.join(", ")}` }, { status: 400 });
    }

    if (!ALLOWED_SEVERITIES.includes(severity)) {
      return NextResponse.json({ success: false, error: `Severidade inválida. Valores aceitos: ${ALLOWED_SEVERITIES.join(", ")}` }, { status: 400 });
    }

    // Extract device_id (fingerprint) from device_info or default
    const deviceId = device_info?.fingerprint || "unknown-device";

    // 3. Insert feedback report
    const { data: newFeedback, error: insertError } = await supabase
      .from("cm_mobile_feedback")
      .insert({
        promotor_id: employeeId,
        device_id: deviceId,
        category,
        severity,
        description: description || null,
        device_timestamp,
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        device_info: device_info || null
      })
      .select()
      .single();

    if (insertError) {
      console.error("[MOBILE FEEDBACK API] Error inserting feedback:", insertError);
      return NextResponse.json({ success: false, error: "Erro ao salvar feedback no banco de dados." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Relatório de problema enviado com sucesso.",
      feedback: newFeedback
    });

  } catch (error: any) {
    console.error("[MOBILE FEEDBACK API] Fatal error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Erro interno do servidor."
    }, { status: 500 });
  }
}
