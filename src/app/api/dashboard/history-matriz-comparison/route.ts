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
    await requirePermission(profile.role, "Hist. p/ Matriz");

    const { searchParams } = new URL(request.url);

    const startMonth = Number(searchParams.get("startMonth") || "1");
    const endMonth = Number(searchParams.get("endMonth") || "12");
    const startMonthStr = String(startMonth).padStart(2, '0');
    const endMonthStr = String(endMonth).padStart(2, '0');

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    const result = await AnalyticsEngine.getHistoryMatrizComparisonData(filters, startMonthStr, endMonthStr);

    if (result.mode === 'monthly') {
      const monthsData = Array.from({ length: 12 }, (_, i) => ({
        mesNum: i + 1,
        mesLabel: MONTHS[i].slice(0, 3),
        mesFull: MONTHS[i],
        fat2025: 0, qty2025: 0, price2025: 0,
        fat2026: 0, qty2026: 0, price2026: 0,
        fatVar: 0, qtyVar: 0, priceVar: 0,
      }));

      for (const row of (result.rows || [])) {
        const monthIndex = Number(row.mes_num) - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          const fat = Number(row.fat || 0);
          const qty = Number(row.qty || 0);
          if (row.ano === '2025') {
            monthsData[monthIndex].fat2025 += fat;
            monthsData[monthIndex].qty2025 += qty;
          }
          if (row.ano === '2026') {
            monthsData[monthIndex].fat2026 += fat;
            monthsData[monthIndex].qty2026 += qty;
          }
        }
      }

      for (const m of monthsData) {
        m.price2025 = m.qty2025 > 0 ? m.fat2025 / m.qty2025 : 0;
        m.price2026 = m.qty2026 > 0 ? m.fat2026 / m.qty2026 : 0;
        m.fatVar = m.fat2025 > 0 ? ((m.fat2026 - m.fat2025) / m.fat2025) * 100 : 0;
        m.qtyVar = m.qty2025 > 0 ? ((m.qty2026 - m.qty2025) / m.qty2025) * 100 : 0;
        m.priceVar = m.price2025 > 0 ? ((m.price2026 - m.price2025) / m.price2025) * 100 : 0;
      }

      const filtered = monthsData.filter(m => m.mesNum >= startMonth && m.mesNum <= endMonth);

      return NextResponse.json({
        success: true,
        mode: "monthly",
        byMonth: filtered,
      });

    } else {
      const matrizMap = new Map<string, {
        matriz: string;
        qty2025: number; qty2026: number;
        fat2025: number; fat2026: number;
      }>();

      for (const row of (result.rows || [])) {
        const matrizName = row.matriz as string;
        if (!matrizMap.has(matrizName)) {
          matrizMap.set(matrizName, {
            matriz: matrizName,
            qty2025: 0, qty2026: 0,
            fat2025: 0, fat2026: 0,
          });
        }
        const entry = matrizMap.get(matrizName)!;
        const fat = Number(row.fat || 0);
        const qty = Number(row.qty || 0);

        if (row.ano === '2025') {
          entry.qty2025 += qty;
          entry.fat2025 += fat;
        }
        if (row.ano === '2026') {
          entry.qty2026 += qty;
          entry.fat2026 += fat;
        }
      }

      const byMatriz = Array.from(matrizMap.values())
        .map(m => {
          const totalQty = m.qty2025 + m.qty2026;
          const price2025 = m.qty2025 > 0 ? m.fat2025 / m.qty2025 : 0;
          const price2026 = m.qty2026 > 0 ? m.fat2026 / m.qty2026 : 0;
          return {
            ...m,
            totalQty,
            price2025,
            price2026,
            qtyVar: m.qty2025 > 0 ? ((m.qty2026 - m.qty2025) / m.qty2025) * 100 : 0,
            fatVar: m.fat2025 > 0 ? ((m.fat2026 - m.fat2025) / m.fat2025) * 100 : 0,
            priceVar: price2025 > 0 ? ((price2026 - price2025) / price2025) * 100 : 0,
          };
        })
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 10)
        .map(({ totalQty, ...rest }) => rest);

      return NextResponse.json({
        success: true,
        mode: "top10",
        byMatriz,
      });
    }
  } catch (error: any) {
    return handleAuthError(error);
  }
}
