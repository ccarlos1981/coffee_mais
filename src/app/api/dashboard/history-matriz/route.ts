import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Hist. Matriz");

    const { searchParams } = new URL(request.url);

    const startMonth = Number(searchParams.get("startMonth") || "1");
    const endMonth = Number(searchParams.get("endMonth") || "12");

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    const rows = await AnalyticsEngine.getHistoryMatrizData(filters);

    function getPrevious3Months(ano: number, mesNum: number): string[] {
      const dates: string[] = [];
      let currAno = ano;
      let currMes = mesNum;
      for (let i = 0; i < 3; i++) {
        currMes--;
        if (currMes === 0) {
          currMes = 12;
          currAno--;
        }
        dates.push(`${currAno}-${String(currMes).padStart(2, '0')}`);
      }
      return dates;
    }

    const dataMap: Record<string, { fat: number; qty: number }> = {};
    for (const row of (rows || [])) {
      const key = `${row.ano}-${String(row.mes_num).padStart(2, '0')}`;
      if (!dataMap[key]) {
        dataMap[key] = { fat: 0, qty: 0 };
      }
      dataMap[key].fat += Number(row.fat || 0);
      dataMap[key].qty += Number(row.qty || 0);
    }

    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const mNum = i + 1;
      const currKey = `2026-${String(mNum).padStart(2, '0')}`;
      const currVal = dataMap[currKey] || { fat: 0, qty: 0 };
      
      const fat2026 = currVal.fat;
      const qty2026 = currVal.qty;
      const price2026 = qty2026 > 0 ? fat2026 / qty2026 : 0;

      const prevMonthsKeys = getPrevious3Months(2026, mNum);
      let sumFatPrev = 0;
      let sumQtyPrev = 0;
      for (const k of prevMonthsKeys) {
        const val = dataMap[k] || { fat: 0, qty: 0 };
        sumFatPrev += val.fat;
        sumQtyPrev += val.qty;
      }

      const prevMonthsLabels = prevMonthsKeys.map(key => {
        const m = Number(key.split("-")[1]);
        const shortMonths = [
          "jan", "fev", "mar", "abr", "mai", "jun",
          "jul", "ago", "set", "out", "nov", "dez"
        ];
        return shortMonths[m - 1];
      });

      const fat2025 = sumFatPrev / 3;
      const qty2025 = sumQtyPrev / 3;
      const price2025 = qty2025 > 0 ? fat2025 / qty2025 : 0;

      const fatVar = fat2025 > 0 ? ((fat2026 - fat2025) / fat2025) * 100 : 0;
      const qtyVar = qty2025 > 0 ? ((qty2026 - qty2025) / qty2025) * 100 : 0;
      const priceVar = price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0;

      return {
        mesNum: mNum,
        mesLabel: MONTHS[i].slice(0, 3),
        mesFull: MONTHS[i],
        prevMonthsList: prevMonthsLabels,
        fat2025,
        qty2025,
        price2025,
        fat2026,
        qty2026,
        price2026,
        fatVar,
        qtyVar,
        priceVar,
      };
    });

    const filteredMonthsData = monthsData.filter(m => m.mesNum >= startMonth && m.mesNum <= endMonth);

    return NextResponse.json({
      success: true,
      byMonth: filteredMonthsData,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
