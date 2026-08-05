import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { CopilotService } from "@/lib/copilot/copilot-service";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const year = yearParam ? parseInt(yearParam, 10) : 2026;
    const month = monthParam ? parseInt(monthParam, 10) : 8;
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // MUST-HAVE 5: Enforce automatic manager RLS scoping for non-admin profiles
    const isAdmin = ["Admin", "Admin Master", "Presidência", "Diretoria", "Gerente Nacional", "CEO"].includes(profile.role);
    if (!isAdmin && (profile.manager_name || user.id)) {
      filters.manager_id = profile.manager_name || user.id;
    }

    const viewModel = await CopilotService.getCopilotViewModel(filters, year, month, limit, offset);

    return NextResponse.json({
      success: true,
      data: viewModel,
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
    const { action, query, customVariationPct } = body;

    const viewModel = await CopilotService.getCopilotViewModel({}, 2026, 8);

    if (action === "CHAT_QUERY" && query) {
      const response = viewModel.chatEngine.processQuery(query);
      return NextResponse.json({
        success: true,
        data: response,
      });
    }

    if (action === "WHAT_IF" && typeof customVariationPct === "number") {
      const result = viewModel.whatIfSimulator.runCustomScenario(customVariationPct);
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    return NextResponse.json({
      success: true,
      data: viewModel,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
