import { NextRequest, NextResponse } from "next/server";
import { CommercialPlanningService } from "@/lib/planning/commercial-planning-service";
import { PlanningTelemetry } from "@/lib/planning/planning-telemetry";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/gestao/metas-rede
 * Domain Handler for Commercial Planning (Metas por Rede).
 * Integrates full structured logging, telemetry, query metrics, and audit logging.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = PlanningTelemetry.createRequestId();
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const managerParam = searchParams.get("manager") || "all";
  const year = yearParam ? parseInt(yearParam, 10) : 2026;

  let userId = "anonymous";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch (err) {
    // Graceful fallback for public/internal calls
  }

  try {
    const payload = await CommercialPlanningService.getMetasRedeData(year);
    const executionTimeMs = Date.now() - startTime;

    const jsonStr = JSON.stringify(payload);
    const payloadSizeBytes = Buffer.byteLength(jsonStr, "utf8");

    // Record telemetry log
    await PlanningTelemetry.logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      userId,
      managerId: managerParam,
      year,
      executionTimeMs,
      queryTimings: payload.queryTimings || { viewSql: 0, salesMv: 0, metasTable: 0 },
      recordCounts: {
        redes: payload.planRedes ? payload.planRedes.length : 0,
        sales: payload.billing ? Object.keys(payload.billing).length : 0,
        metas: payload.metas ? payload.metas.length : 0
      },
      payloadSizeBytes,
      status: "SUCCESS"
    });

    const response = NextResponse.json(payload);
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Execution-Time-MS", String(executionTimeMs));
    return response;
  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;

    await PlanningTelemetry.logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      userId,
      managerId: managerParam,
      year,
      executionTimeMs,
      queryTimings: { viewSql: 0, salesMv: 0, metasTable: 0 },
      recordCounts: { redes: 0, sales: 0, metas: 0 },
      payloadSizeBytes: 0,
      status: "ERROR",
      error: error?.message || "Internal server error"
    });

    return NextResponse.json(
      { error: error?.message || "Internal server error during metas-rede fetching." },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}
