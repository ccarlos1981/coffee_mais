import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const intelligenceData = await CommercialIntelligenceEngine.getCommercialIntelligence(filters);

    return NextResponse.json({
      success: true,
      data: intelligenceData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
