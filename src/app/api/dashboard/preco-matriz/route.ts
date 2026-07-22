import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Preço");

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || "2026";

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    filters.startMonth = `${year}-01`;
    filters.endMonth = `${year}-12`;

    const rows = await AnalyticsEngine.getPrecoMatrizData(filters);

    const matrizMap = new Map<string, Record<number, { fat: number; qty: number }>>();

    for (const row of (rows || [])) {
      const matrizName = row.matriz as string;
      const monthNum = parseInt(String(row.month).split('-')[1], 10);
      if (!matrizMap.has(matrizName)) {
        matrizMap.set(matrizName, {});
      }
      const mDict = matrizMap.get(matrizName)!;
      if (!mDict[monthNum]) {
        mDict[monthNum] = { fat: 0, qty: 0 };
      }
      mDict[monthNum].fat += Number(row.fat || 0);
      mDict[monthNum].qty += Number(row.qty || 0);
    }

    const byMatriz = Array.from(matrizMap.entries()).map(([matriz, mDict]) => {
      const months = Array.from({ length: 12 }, (_, i) => {
        const mNum = i + 1;
        const data = mDict[mNum] || { fat: 0, qty: 0 };
        return {
          monthNum: mNum,
          fat: data.fat,
          qty: data.qty,
          price: data.qty > 0 ? data.fat / data.qty : 0,
        };
      });
      const totalFat = months.reduce((s, m) => s + m.fat, 0);
      const totalQty = months.reduce((s, m) => s + m.qty, 0);
      return {
        matriz,
        totalFat,
        totalQty,
        avgPrice: totalQty > 0 ? totalFat / totalQty : 0,
        months,
      };
    }).sort((a, b) => b.totalFat - a.totalFat);

    return NextResponse.json({
      success: true,
      byMatriz,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
