import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerFraudIncident, FraudCounterType } from "@/lib/antifraud/fraud-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = [
  "APP_CRASH",
  "GPS_MOCK_DETECTED",
  "LOGIN_FAILED",
  "BATTERY_CRITICAL",
  "PHOTO_UPLOAD_FAILED",
  "DEVICE_CHANGED"
];

const ALLOWED_SEVERITIES = ["WARN", "ERROR", "CRITICAL"];

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
    
    // Support either a single log object or an array of logs
    const rawLogs = Array.isArray(body) ? body : [body];
    const insertedLogs = [];

    const todayStr = new Date().toISOString().split("T")[0];

    for (const log of rawLogs) {
      const { device_id, app_version, os, event_type, severity, payload_json } = log;

      if (!device_id || !app_version || !os || !event_type || !severity) {
        continue; // Skip invalid log payload
      }

      // Check filters: only persist WARN/ERROR/CRITICAL and allowed events
      if (!ALLOWED_SEVERITIES.includes(severity) || !ALLOWED_EVENTS.includes(event_type)) {
        continue; // Skip logs that don't match criteria
      }

      // Insert log into public.cm_mobile_app_logs
      const { data: newLog, error: insertError } = await supabase
        .from("cm_mobile_app_logs")
        .insert({
          promotor_id: employeeId,
          device_id,
          app_version,
          os,
          event_type,
          severity,
          payload_json: payload_json || null
        })
        .select()
        .single();

      if (insertError) {
        console.error("[MOBILE LOG API] Error inserting log:", insertError);
        continue;
      }

      insertedLogs.push(newLog);

      // Trigger Fraud Incident dynamically if applicable
      if (event_type === "GPS_MOCK_DETECTED") {
        await registerFraudIncident(employeeId, "gps_mock", todayStr);
      } else if (event_type === "DEVICE_CHANGED") {
        await registerFraudIncident(employeeId, "device_change", todayStr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${insertedLogs.length} logs processados e salvos com sucesso.`
    });

  } catch (error: any) {
    console.error("[MOBILE LOG API] Fatal error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Erro ao processar logs móveis."
    }, { status: 500 });
  }
}
