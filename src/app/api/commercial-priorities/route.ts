import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { CommercialPrioritiesService } from "@/lib/priorities";

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
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Automatic RLS Manager scoping for non-admin profiles
    const isAdmin = ["Admin", "Admin Master", "Presidência", "Diretoria", "Gerente Nacional", "CEO"].includes(profile.role);
    if (!isAdmin && (profile.manager_name || user.id)) {
      filters.manager_id = profile.manager_name || user.id;
    }

    const viewModel = await CommercialPrioritiesService.getCommercialPrioritiesViewModel(filters, year, month, limit, offset);

    return NextResponse.json({
      success: true,
      data: viewModel,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
