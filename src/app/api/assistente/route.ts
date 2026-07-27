import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { CommercialAssistantEngine } from "@/lib/governance/analytics/assistant";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);
    const question = searchParams.get("q") || "Qual é o faturamento e forecast do mês?";

    const response = await CommercialAssistantEngine.queryAssistant(question, filters);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);
    const question = body.question || "Qual é o faturamento oficial?";

    const response = await CommercialAssistantEngine.queryAssistant(question, filters);

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
