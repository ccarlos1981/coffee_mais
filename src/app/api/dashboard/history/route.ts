import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Histórico");

    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    let startMonth: string, endMonth: string;
    if (startStr && endStr) {
      startMonth = startStr;
      endMonth = endStr;
    } else {
      const endYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
      const startYear = endYear - 2;
      startMonth = `${startYear}-01`;
      endMonth = `${endYear}-12`;
    }

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    filters.startMonth = startMonth;
    filters.endMonth = endMonth;

    const rows = await AnalyticsEngine.getHistoryData(filters);

    const monthlyMap = new Map<string, { monthKey: string; year: string; fat: number; qty: number; maco: number }>();
    const familiaMap = new Map<string, { familia: string; fat: number; qty: number; maco: number }>();
    const clientMap = new Map<string, { client: string; fat: number; qty: number; maco: number }>();

    for (const row of (rows || [])) {
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const maco = Number(row.maco || 0);

      const monthKey = row.mes;
      const existing = monthlyMap.get(monthKey) || { monthKey, year: row.ano, fat: 0, qty: 0, maco: 0 };
      existing.fat += fat;
      existing.qty += qty;
      existing.maco += maco;
      monthlyMap.set(monthKey, existing);

      const familia = row.tipo_produto || 'Outros';
      const existingFam = familiaMap.get(familia) || { familia, fat: 0, qty: 0, maco: 0 };
      existingFam.fat += fat;
      existingFam.qty += qty;
      existingFam.maco += maco;
      familiaMap.set(familia, existingFam);

      const client = row.rede || 'Não Mapeado';
      const existingClient = clientMap.get(client) || { client, fat: 0, qty: 0, maco: 0 };
      existingClient.fat += fat;
      existingClient.qty += qty;
      existingClient.maco += maco;
      clientMap.set(client, existingClient);
    }

    const monthlyHistory = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    const byFamilia = Array.from(familiaMap.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);
    const byClient = Array.from(clientMap.values()).sort((a, b) => b.fat - a.fat).slice(0, 10);

    const totalFat = monthlyHistory.reduce((s, m) => s + m.fat, 0);
    const totalQty = monthlyHistory.reduce((s, m) => s + m.qty, 0);
    const totalMaco = monthlyHistory.reduce((s, m) => s + m.maco, 0);

    return NextResponse.json({
      success: true,
      monthlyHistory,
      byFamilia,
      byClient,
      totals: { fat: totalFat, qty: totalQty, maco: totalMaco }
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
