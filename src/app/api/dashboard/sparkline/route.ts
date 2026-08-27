import { NextResponse } from "next/server";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import {
  requireAuth,
  requireApprovedProfile,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";
import { resolveCanonicalManager, isSameManager } from "@/lib/domain/canonical";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

const NATIONAL_ROLES = ["Admin", "Admin Master", "CEO", "Diretor", "Gerente Nacional", "Trade", "Financeiro"];

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
    const months = parseInt(searchParams.get("months") || "6");

    const dStart = new Date(year, month - 1 - (months - 1), 1);
    const startMonth = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, "0")}`;
    const endMonth = `${year}-${String(month).padStart(2, "0")}`;

    const filters = parseAnalyticsFiltersFromParams(searchParams);
    filters.startMonth = startMonth;
    filters.endMonth = endMonth;

    // Enforce Regional Scope for Gerente Regional
    const userRole = (profile.role || "").trim();
    const isNational = NATIONAL_ROLES.some(r => r.toLowerCase() === userRole.toLowerCase());

    if (!isNational && userRole.toLowerCase() === "gerente regional") {
      const canonicalUserMgr = resolveCanonicalManager(profile.manager_name || profile.name || "").managerName;
      if (filters.manager) {
        const managers = filters.manager.split(',').map(m => resolveCanonicalManager(m).managerName);
        const hasOther = managers.some(m => !isSameManager(m, canonicalUserMgr));
        if (hasOther) {
          filters.manager = canonicalUserMgr;
        }
      } else {
        filters.manager = canonicalUserMgr;
      }
    }

    const data = await AnalyticsEngine.getSparklineData(filters);

    const monthlyMap = new Map<string, { fat: number }>();
    if (data) {
      for (const row of data) {
        const existing = monthlyMap.get(row.mes) || { fat: 0 };
        existing.fat += Number(row.fat || 0);
        monthlyMap.set(row.mes, existing);
      }
    }

    const series: { month: string; fat: number }[] = [];
    let cur = new Date(dStart);
    for (let i = 0; i < months; i++) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key) || { fat: 0 };
      series.push({
        month: key,
        fat: Math.round(entry.fat),
      });
      cur.setMonth(cur.getMonth() + 1);
    }

    return NextResponse.json({ success: true, series });
  } catch (error: unknown) {
    return handleAuthError(error);
  }
}

