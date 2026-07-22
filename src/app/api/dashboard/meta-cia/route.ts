import { NextResponse } from "next/server";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const type = searchParams.get("type") || "revenue";

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    filters.startMonth = `${year}-01`;
    filters.endMonth = `${year}-12`;

    const rows = await AnalyticsEngine.getMetaCiaData(filters);

    const monthTotalMap = new Map<number, number>();

    for (const row of (rows || [])) {
      const monthNum = parseInt(String(row.month).split('-')[1], 10);
      const value = type === "qty" ? Number(row.qty || 0) : Number(row.fat || 0);
      monthTotalMap.set(monthNum, (monthTotalMap.get(monthNum) || 0) + value);
    }

    const totals: { month: number; amount: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      totals.push({
        month: m,
        amount: Math.round(monthTotalMap.get(m) || 0),
      });
    }

    return NextResponse.json({
      success: true,
      year,
      totals,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
