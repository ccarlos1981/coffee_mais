import { createAdminClient } from "@/lib/supabase/admin";

interface TelemetryParams {
  route: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  promotorId?: string | null;
  errorMessage?: string | null;
}

export async function logApiTelemetry({
  route,
  method,
  statusCode,
  responseTimeMs,
  promotorId,
  errorMessage
}: TelemetryParams) {
  try {
    const supabase = createAdminClient();
    await supabase.from("cm_system_api_logs").insert({
      route,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      promotor_id: promotorId || null,
      error_message: errorMessage || null
    });
  } catch (err) {
    // Fail silently in telemetry to prevent blocking operational features
    console.error("[TELEMETRY ERROR] Failed to record API log:", err);
  }
}
