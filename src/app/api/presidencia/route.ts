import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, requireRole, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { PresidencyDashboardEngine } from "@/lib/governance/analytics/presidency";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXECUTIVE_ROLES = ["CEO", "Presidência", "Diretoria", "Gerente Nacional", "Admin", "Admin Master"];

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    requireRole(profile, EXECUTIVE_ROLES);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const presidencyData = await PresidencyDashboardEngine.getPresidencyDashboard(filters);

    return NextResponse.json({
      success: true,
      data: presidencyData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
