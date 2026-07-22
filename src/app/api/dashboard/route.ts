import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5;

function aggregateFromMV(
  rows: any[],
  investmentPct: number,
  clientRows?: any[],
  pmClientMap?: Map<string, { fat: number; qty: number; maco: number }>,
  pyClientMap?: Map<string, { fat: number; qty: number; maco: number }>
) {
  const byManagerMap: Record<string, {
    managerId: string;
    managerName: string;
    fat: number; qty: number; maco: number; vendaFutura: number;
    paceFat: number; paceQty: number; paceMaco: number;
    byClient: Record<string, { client: string; fat: number; qty: number; maco: number }>;
  }> = {};

  const byFamiliaMap: Record<string, { fat: number; qty: number }> = {};
  let totalFat = 0, totalQty = 0, totalMaco = 0, totalVendaFutura = 0;

  for (const row of rows) {
    const mId = row.manager_id || '9999';
    const mName = row.manager || 'Outros';
    const familia = row.tipo_produto || 'Outros';
    const fat = Number(row.fat || 0);
    const qty = Number(row.qty || 0);
    const maco = investmentPct > 0
      ? Number(row.maco || 0) - (fat * investmentPct)
      : Number(row.maco || 0);
    const vendaFutura = Number(row.valor_venda_futura || 0);

    totalFat += fat;
    totalQty += qty;
    totalMaco += maco;
    totalVendaFutura += vendaFutura;

    if (!byManagerMap[mId]) {
      byManagerMap[mId] = { managerId: mId, managerName: mName, fat: 0, qty: 0, maco: 0, vendaFutura: 0, paceFat: 0, paceQty: 0, paceMaco: 0, byClient: {} };
    }
    byManagerMap[mId].fat += fat;
    byManagerMap[mId].qty += qty;
    byManagerMap[mId].maco += maco;
    byManagerMap[mId].vendaFutura += vendaFutura;

    if (familia !== 'Outros') {
      if (!byFamiliaMap[familia]) byFamiliaMap[familia] = { fat: 0, qty: 0 };
      byFamiliaMap[familia].fat += fat;
      byFamiliaMap[familia].qty += qty;
    }
  }

  if (clientRows) {
    for (const row of clientRows) {
      const mId = row.manager_id || '9999';
      const mName = row.manager || 'Outros';
      const client = row.client || 'Não Mapeado';
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const maco = investmentPct > 0
        ? Number(row.maco || 0) - (fat * investmentPct)
        : Number(row.maco || 0);

      if (!byManagerMap[mId]) {
        byManagerMap[mId] = { managerId: mId, managerName: mName, fat: 0, qty: 0, maco: 0, vendaFutura: 0, paceFat: 0, paceQty: 0, paceMaco: 0, byClient: {} };
      }

      if (!byManagerMap[mId].byClient[client]) {
        byManagerMap[mId].byClient[client] = { client, fat: 0, qty: 0, maco: 0 };
      }
      byManagerMap[mId].byClient[client].fat += fat;
      byManagerMap[mId].byClient[client].qty += qty;
      byManagerMap[mId].byClient[client].maco += maco;
    }
  }

  for (const mgrData of Object.values(byManagerMap)) {
    mgrData.paceFat = mgrData.fat;
    mgrData.paceQty = mgrData.qty;
    mgrData.paceMaco = mgrData.maco;
  }

  const byManager = Object.entries(byManagerMap).map(([managerId, data]) => {
    const clients = Object.values(data.byClient)
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 20)
      .map(c => ({
        ...c,
        prevMonthFat: pmClientMap?.get(c.client)?.fat || 0,
        prevYearFat: pyClientMap?.get(c.client)?.fat || 0,
        paceFat: c.fat,
        paceQty: c.qty,
        paceMaco: c.maco,
      }));
    return {
      manager: data.managerName,
      manager_id: managerId,
      fat: data.fat,
      qty: data.qty,
      maco: data.maco,
      vendaFutura: data.vendaFutura,
      paceFat: data.paceFat,
      paceQty: data.paceQty,
      paceMaco: data.paceMaco,
      topClients: clients,
    };
  }).sort((a, b) => b.fat - a.fat);

  const byFamilia = Object.entries(byFamiliaMap)
    .map(([familia, data]) => ({
      familia,
      fat: data.fat,
      qty: data.qty,
      pct: totalFat > 0 ? (data.fat / totalFat) * 100 : 0,
    }))
    .sort((a, b) => b.fat - a.fat);

  return {
    byManager,
    byFamilia,
    totals: {
      fat: totalFat, qty: totalQty, maco: totalMaco, vendaFutura: totalVendaFutura,
      paceFat: totalFat, paceQty: totalQty, paceMaco: totalMaco,
    },
  };
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Vendas");

    const { searchParams } = new URL(request.url);
    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const cacheKey = JSON.stringify({ ...filters });
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const data = await AnalyticsEngine.getVendasSummary(filters);

    const pmClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    for (const r of data.rowsPmClient) {
      const existing = pmClientMap.get(r.client) || { fat: 0, qty: 0, maco: 0 };
      pmClientMap.set(r.client, {
        fat: existing.fat + Number(r.fat || 0),
        qty: existing.qty + Number(r.qty || 0),
        maco: existing.maco + Number(r.maco || 0),
      });
    }

    const pyClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    for (const r of data.rowsPyClient) {
      const existing = pyClientMap.get(r.client) || { fat: 0, qty: 0, maco: 0 };
      pyClientMap.set(r.client, {
        fat: existing.fat + Number(r.fat || 0),
        qty: existing.qty + Number(r.qty || 0),
        maco: existing.maco + Number(r.maco || 0),
      });
    }

    const curAgg = aggregateFromMV(data.rowsCur, data.investmentPct, data.rowsCurClient, pmClientMap, pyClientMap);
    const pmAgg = aggregateFromMV(data.rowsPm, data.investmentPct);
    const pyAgg = aggregateFromMV(data.rowsPy, data.investmentPct);

    const payload = {
      success: true,
      current: curAgg,
      prevMonth: pmAgg,
      prevYear: pyAgg,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
