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
    await requirePermission(profile.role, "Matriz");

    const { searchParams } = new URL(request.url);
    const enableHistory = searchParams.get('history') === 'true';
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const data = await AnalyticsEngine.getMatrizData(filters, enableHistory);

    const totalsRow = data.totals || { fat: 0, qty: 0, maco: 0 };
    const totals = {
      fat: Number(totalsRow.fat || 0),
      qty: Number(totalsRow.qty || 0),
      maco: Number(totalsRow.maco || 0),
      record_count: data.byMatriz.length,
    };
    const totalFat = totals.fat;

    const byMatriz = data.byMatriz
      .map((row: any, i: number) => {
        const fat = Number(row.fat || 0);
        const qty = Number(row.qty || 0);
        const maco = Number(row.maco || 0);
        return {
          matriz: row.matriz,
          fat,
          qty,
          maco,
          rk_kg: qty > 0 ? fat / qty : 0,
          maco_kg: qty > 0 ? maco / qty : 0,
          v_futura: 0,
          devolucoes: 0,
          bonif: 0,
          rank: i + 1,
        };
      })
      .sort((a: any, b: any) => b.fat - a.fat)
      .map((item: any, i: number) => ({ ...item, rank: i + 1 }));

    const byManager = data.byManager
      .map((row: any) => {
        const fat = Number(row.fat || 0);
        return {
          name: row.name || 'Outros',
          fat,
          pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => b.fat - a.fat);

    const byFamilia = data.byFamilia
      .map((row: any) => {
        const fat = Number(row.fat || 0);
        return {
          familia: row.familia || 'Outros',
          fat,
          pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => b.fat - a.fat);

    const byMonth = data.byMonth
      .map((row: any) => ({
        month: row.month,
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
        maco: Number(row.maco || 0),
      }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

    const byProduct = data.topProducts
      .map((row: any) => ({
        product: row.product || 'Outros',
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
      }))
      .sort((a: any, b: any) => b.fat - a.fat);

    const payload = {
      success: true,
      totals,
      byMatriz,
      byManager,
      byProduct,
      byFamilia,
      byMonth,
      recordCount: data.byMatriz.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
