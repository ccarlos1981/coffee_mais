import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const globalData = await AnalyticsEngine.getGlobalFilterData();

    let latestPeriod = { year: 2026, month: 7 };
    if (globalData.maxDate) {
      const parts = globalData.maxDate.split('-');
      if (parts.length >= 2) {
        latestPeriod = {
          year: Number(parts[0]),
          month: Number(parts[1]),
        };
      }
    }

    return NextResponse.json({
      success: true,
      filters: {
        managers: globalData.managers || [],
        familias: globalData.familias || ["1 KG", "5 KG", "Acessório", "Café Verde", "Cápsula", "Drip", "Geisha", "Grão", "Moído"],
        ufs: globalData.ufs || [],
        channels: globalData.channels || [],
        products: globalData.products || [],
        matrizes: globalData.redes || [],
      },
      latestPeriod,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
