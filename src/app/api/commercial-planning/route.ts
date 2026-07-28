import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CommercialPlanningEngine, PlanningFilterOptions } from "@/lib/commercial-planning";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters: PlanningFilterOptions = {
      gerente: searchParams.get("gerente") || undefined,
      regional: searchParams.get("regional") || undefined,
      cicloId: searchParams.get("cicloId") || undefined,
    };

    const planningData = CommercialPlanningEngine.getCommercialPlanningData(filters);

    return NextResponse.json({
      success: true,
      data: planningData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
