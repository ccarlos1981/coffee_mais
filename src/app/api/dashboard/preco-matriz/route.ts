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
    const year = searchParams.get("year") || searchParams.get("ano") || "2026";

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    filters.startMonth = `${year}-01`;
    filters.endMonth = `${year}-12`;

    const rows = await AnalyticsEngine.getPrecoMatrizData(filters);

    const channelMap = new Map<string, Record<number, { fat: number; qty: number }>>();
    const matrizMap = new Map<string, Record<number, { fat: number; qty: number }>>();
    const familyMap = new Map<string, Record<number, { fat: number; qty: number }>>();
    const matrizFamilyMap = new Map<string, Record<number, { fat: number; qty: number }>>();

    for (const row of (rows || [])) {
      const monthNum = parseInt(String(row.month).split('-')[1], 10);
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const ch = (row.channel || 'Outros') as string;
      const mat = (row.matriz || 'Não Mapeado') as string;
      const fam = (row.family || 'Outros') as string;

      // Channel
      if (!channelMap.has(ch)) channelMap.set(ch, {});
      const cDict = channelMap.get(ch)!;
      if (!cDict[monthNum]) cDict[monthNum] = { fat: 0, qty: 0 };
      cDict[monthNum].fat += fat; cDict[monthNum].qty += qty;

      // Matriz
      if (!matrizMap.has(mat)) matrizMap.set(mat, {});
      const mDict = matrizMap.get(mat)!;
      if (!mDict[monthNum]) mDict[monthNum] = { fat: 0, qty: 0 };
      mDict[monthNum].fat += fat; mDict[monthNum].qty += qty;

      // Channel Family
      const cfKey = `${ch}||${fam}`;
      if (!familyMap.has(cfKey)) familyMap.set(cfKey, {});
      const cfDict = familyMap.get(cfKey)!;
      if (!cfDict[monthNum]) cfDict[monthNum] = { fat: 0, qty: 0 };
      cfDict[monthNum].fat += fat; cfDict[monthNum].qty += qty;

      // Matriz Family
      const mfKey = `${mat}||${fam}`;
      if (!matrizFamilyMap.has(mfKey)) matrizFamilyMap.set(mfKey, {});
      const mfDict = matrizFamilyMap.get(mfKey)!;
      if (!mfDict[monthNum]) mfDict[monthNum] = { fat: 0, qty: 0 };
      mfDict[monthNum].fat += fat; mfDict[monthNum].qty += qty;
    }

    const buildRows = (map: Map<string, Record<number, { fat: number; qty: number }>>, keyField: string) => {
      return Array.from(map.entries()).map(([key, dict]) => {
        const monthPrices: Record<number, number> = {};
        let totalFat = 0;
        let totalQty = 0;

        for (let m = 1; m <= 12; m++) {
          const d = dict[m] || { fat: 0, qty: 0 };
          totalFat += d.fat;
          totalQty += d.qty;
          monthPrices[m] = d.qty > 0 ? d.fat / d.qty : 0;
        }

        const parts = key.split('||');
        if (parts.length === 2) {
          return {
            [keyField]: parts[0],
            family: parts[1],
            totalFat,
            totalQty,
            avgPrice: totalQty > 0 ? totalFat / totalQty : 0,
            monthPrices,
          };
        }

        return {
          [keyField]: key,
          totalFat,
          totalQty,
          avgPrice: totalQty > 0 ? totalFat / totalQty : 0,
          monthPrices,
        };
      }).sort((a: any, b: any) => b.totalFat - a.totalFat);
    };

    const channels = buildRows(channelMap, 'channel');
    const matrizes = buildRows(matrizMap, 'matriz');
    const families = buildRows(familyMap, 'channel');
    const matrizFamilies = buildRows(matrizFamilyMap, 'matriz');

    return NextResponse.json({
      success: true,
      channels,
      matrizes,
      families,
      matrizFamilies,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
