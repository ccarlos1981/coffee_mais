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
    await requirePermission(profile.role, "Positivação");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const data = await AnalyticsEngine.getPositivacaoData(filters);

    const totalClientes = Number(data.totals.clientes || 0);
    const totalMatrizes = Number(data.totals.matrizes || 0);
    const totalFat = Number(data.totals.fat || 0);
    const numMeses = Number(data.totals.meses || 1) || 1;

    const totals = {
      clientes: totalClientes,
      matrizes: totalMatrizes,
      fat: totalFat,
      ticketMedioCliente: totalClientes > 0 ? totalFat / totalClientes : 0,
      ticketMedioMatriz: totalMatrizes > 0 ? totalFat / totalMatrizes : 0,
      mediaMensalClientes: Math.round(totalClientes / numMeses),
    };

    const byMonth = data.byMonth.map((row: any) => {
      const fat = Number(row.fat || 0);
      const clientes = Number(row.clientes || 0);
      const matrizes = Number(row.matrizes || 0);
      return {
        month: row.month,
        clientes,
        matrizes,
        fat,
        qty: Number(row.qty || 0),
        ticketMedioCliente: clientes > 0 ? fat / clientes : 0,
        ticketMedioMatriz: matrizes > 0 ? fat / matrizes : 0,
      };
    });

    const byManager = data.byManager.map((row: any) => {
      const fat = Number(row.fat || 0);
      const clientes = Number(row.clientes || 0);
      const matrizes = Number(row.matrizes || 0);
      return {
        manager: row.manager || 'Outros',
        clientes,
        matrizes,
        fat,
        ticketMedioCliente: clientes > 0 ? fat / clientes : 0,
        pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
      };
    }).sort((a: any, b: any) => b.clientes - a.clientes);

    const months = Array.from(new Set(data.managerMonthly.map((r: any) => r.month))).sort();
    const managerMonthMap: Record<string, Record<string, number>> = {};
    for (const r of data.managerMonthly) {
      const mgr = r.manager || 'Outros';
      if (!managerMonthMap[mgr]) managerMonthMap[mgr] = {};
      managerMonthMap[mgr][r.month] = Number(r.clientes || 0);
    }
    const managerMonthlyPivot = Object.entries(managerMonthMap).map(([mgr, mData]) => ({
      manager: mgr,
      months: mData,
    }));

    const topSkus = data.topSkus.map((r: any) => r.sku);
    const skuMonthMap: Record<string, Record<string, number>> = {};
    for (const r of data.batalhaMonthly) {
      const sku = r.sku || 'Outros';
      if (!skuMonthMap[sku]) skuMonthMap[sku] = {};
      skuMonthMap[sku][r.month] = Number(r.clientes || 0);
    }
    const batalhaNaval = Object.entries(skuMonthMap).map(([sku, mData]) => ({
      sku,
      months: mData,
    }));

    const payload = {
      success: true,
      totals,
      byMonth,
      byManager,
      managerMonthlyPivot,
      batalhaNaval,
      months,
      topSkus,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
