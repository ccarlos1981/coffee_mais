import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { CommercialDecisionEngine, DecisionFilterOptions } from "@/lib/commercial-decision";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters: DecisionFilterOptions = {
      gerente: searchParams.get("gerente") || undefined,
      regional: searchParams.get("regional") || undefined,
      nivelRisco: searchParams.get("nivelRisco") || undefined,
      categoria: searchParams.get("categoria") || undefined,
    };

    const decisionData = CommercialDecisionEngine.getCommercialDecisionData(filters);

    return NextResponse.json({
      success: true,
      data: decisionData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
