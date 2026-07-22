import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const data = await AnalyticsEngine.getSkuPdvData(filters);

    const totalFat = Number(data.totals.fat || 0);

    const bySku = data.bySku.map((row: any) => {
      const fat = Number(row.fat || 0);
      return {
        sku: row.sku,
        familia: row.familia,
        pdvs: Number(row.pdvs || 0),
        redes: Number(row.redes || 0),
        fat,
        qty: Number(row.qty || 0),
        pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
      };
    });

    const byFamilia = data.byFamilia.map((row: any) => {
      const fat = Number(row.fat || 0);
      return {
        familia: row.familia,
        skus: Number(row.skus || 0),
        pdvs: Number(row.pdvs || 0),
        fat,
        qty: Number(row.qty || 0),
        pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
      };
    });

    const byMonth = data.byMonth.map((row: any) => ({
      month: row.month,
      skus: Number(row.skus || 0),
      pdvs: Number(row.pdvs || 0),
      fat: Number(row.fat || 0),
      qty: Number(row.qty || 0),
    }));

    return NextResponse.json({
      success: true,
      totals: {
        totalSkus: Number(data.totals.total_skus || 0),
        totalPdvs: Number(data.totals.total_pdvs || 0),
        totalRedes: Number(data.totals.total_redes || 0),
        fat: totalFat,
        qty: Number(data.totals.qty || 0),
      },
      bySku,
      byFamilia,
      byMonth,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
