import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5;

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Positivação");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const action = searchParams.get('action');
    const targetFamilia = searchParams.get('targetFamilia');
    const targetSku = searchParams.get('targetSku');

    // Sub-rota para lazy loading de clientes do SKU no nível 3 do Drill Down
    if (action === 'clients' && targetFamilia && targetSku) {
      const clients = await AnalyticsEngine.getFamiliaClientBreakdownData(filters, targetFamilia, targetSku);
      return NextResponse.json({ success: true, clients });
    }

    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const data = await AnalyticsEngine.getHistoricoFamiliaData(filters);

    const payload = {
      success: true,
      ...data
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
