import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Positivação");

    const { searchParams } = new URL(request.url);
    const selectedManager = searchParams.get('manager');
    const type = searchParams.get('type') || 'client';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.max(1, Number(searchParams.get('limit') || 10));
    const offset = (page - 1) * limit;

    if (!selectedManager) {
      return NextResponse.json({ success: false, error: 'Manager parameter is required' }, { status: 400 });
    }

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    if (searchParams.get('filterManager') && searchParams.get('filterManager') !== 'all') {
      filters.manager = searchParams.get('filterManager');
    }

    const detailData = await AnalyticsEngine.getPositivacaoDetailData(filters, selectedManager, type, limit, offset);

    return NextResponse.json({
      success: true,
      ...detailData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
