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
  const monthParam = searchParams.get("month");
  const managerParam = searchParams.get("manager") || "all";
  const year = yearParam ? parseInt(yearParam, 10) : 2026;
  const month = monthParam ? parseInt(monthParam, 10) : 8;

  let userId = "anonymous";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  } catch (err) {
    // Graceful fallback for public/internal calls
  }

  try {
    const viewModel = await CommercialPlanningService.getMetasRedeViewModel(year, month);
    const executionTimeMs = Date.now() - startTime;

    const jsonStr = JSON.stringify(viewModel);
    const payloadSizeBytes = Buffer.byteLength(jsonStr, "utf8");

    // Record telemetry log
    await PlanningTelemetry.logRequest({
      requestId,
      timestamp: new Date().toISOString(),
      userId,
      managerId: managerParam,
      year,
      executionTimeMs,
      queryTimings: {
        sqlTimeMs: viewModel.telemetry.sqlTimeMs,
        backendTimeMs: viewModel.telemetry.backendTimeMs
      },
      recordCounts: {
        redes: viewModel.totalRedes,
        sales: viewModel.totalManagers,
        metas: viewModel.preenchidas
      },
      payloadSizeBytes,
      status: "SUCCESS"
    });

    const response = NextResponse.json(viewModel);
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("X-Execution-Time-MS", String(executionTimeMs));
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
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

/**
 * POST /api/gestao/metas-rede
 * Handles Workflow Status Transitions and Goal Upserts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, year, month, targetStatus, user, comments } = body;

    if (action === "WORKFLOW_TRANSITION") {
      if (!year || !month || !targetStatus) {
        return NextResponse.json({ error: "Parâmetros inválidos para transição de workflow." }, { status: 400 });
      }

      const updatedWorkflow = await CommercialPlanningService.updateWorkflowStatus(
        Number(year),
        Number(month),
        targetStatus,
        user || "Sistema",
        comments
      );

      return NextResponse.json({ success: true, workflow: updatedWorkflow });
    }

    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  } catch (error: any) {
    console.error("[POST /api/gestao/metas-rede] Error:", error);
    return NextResponse.json({ error: error?.message || "Erro ao processar requisição." }, { status: 500 });
  }
}
