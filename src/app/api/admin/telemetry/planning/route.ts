import { NextRequest, NextResponse } from "next/server";
import { PlanningTelemetry } from "@/lib/planning/planning-telemetry";

/**
 * GET /api/admin/telemetry/planning
 * Operational Dashboard & Telemetry Metrics Endpoint for Commercial Planning (Metas por Rede).
 * Provides P50, P95, P99 metrics, SLAs, active alerts stream, and audit log history.
 */
export async function GET(req: NextRequest) {
  try {
    const dashboardData = PlanningTelemetry.getDashboardData();
    return NextResponse.json(dashboardData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch operational telemetry dashboard data." },
      { status: 500 }
    );
  }
}
