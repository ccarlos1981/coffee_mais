import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CommercialScenarioEngine, ScenarioFilterOptions } from "@/lib/commercial-scenarios";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters: ScenarioFilterOptions = {
      gerente: searchParams.get("gerente") || undefined,
      regional: searchParams.get("regional") || undefined,
      cenarioId: searchParams.get("cenarioId") || undefined,
    };

    const scenarioData = CommercialScenarioEngine.getCommercialScenarioData(filters);

    return NextResponse.json({
      success: true,
      data: scenarioData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
