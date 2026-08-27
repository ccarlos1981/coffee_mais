import { NextRequest, NextResponse } from "next/server";
import { PlanningTelemetry } from "@/lib/planning/planning-telemetry";
import {
  requireAuth,
  requireApprovedProfile,
  requireRole,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["Admin", "Admin Master", "CEO"];

/**
 * GET /api/admin/telemetry/planning
 * Operational Dashboard & Telemetry Metrics Endpoint for Commercial Planning (Metas por Rede).
 * Provides P50, P95, P99 metrics, SLAs, active alerts stream, and audit log history.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, ALLOWED_ROLES);

    const dashboardData = PlanningTelemetry.getDashboardData();
    return NextResponse.json(dashboardData);
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

