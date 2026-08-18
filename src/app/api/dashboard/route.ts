import { NextResponse } from "next/server";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { AnalyticsEngine, parseAnalyticsFiltersFromParams } from "@/lib/governance/analytics";
import { DashboardCache } from "@/lib/cache/dashboard-cache";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function aggregateFromMV(
  rows: any[],
  investmentPct: number,
  clientRows?: any[],
  pmClientMap?: Map<string, { fat: number; qty: number; maco: number }>,
  pyClientMap?: Map<string, { fat: number; qty: number; maco: number }>,
  paceResult?: {
    rowsPmRemainderManager: any[];
    rowsPmRemainderClient: any[];
    rowsPmRemainderFamilia: any[];
    refDay: number;
    cutOffDay: number;
    isPastMonth: boolean;
    isFutureMonth: boolean;
  }
) {
  const byManagerMap: Record<string, {
    managerId: string;
    managerName: string;
    fat: number; qty: number; maco: number; vendaFutura: number;
    paceFat: number; paceQty: number; paceMaco: number;
    byClient: Record<string, {
      client: string;
      channel: string;
      manager: string;
      manager_id: string;
      fat: number;
      qty: number;
      maco: number;
      valor_venda_futura: number;
    }>;
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
      const channel = row.channel || 'Outros';
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const maco = investmentPct > 0
        ? Number(row.maco || 0) - (fat * investmentPct)
        : Number(row.maco || 0);

      if (!byManagerMap[mId]) {
        byManagerMap[mId] = { managerId: mId, managerName: mName, fat: 0, qty: 0, maco: 0, vendaFutura: 0, paceFat: 0, paceQty: 0, paceMaco: 0, byClient: {} };
      }

      if (!byManagerMap[mId].byClient[client]) {
        byManagerMap[mId].byClient[client] = {
          client,
          channel,
          manager: mName,
          manager_id: mId,
          fat: 0,
          qty: 0,
          maco: 0,
          valor_venda_futura: 0
        };
      }
      byManagerMap[mId].byClient[client].fat += fat;
      byManagerMap[mId].byClient[client].qty += qty;
      byManagerMap[mId].byClient[client].maco += maco;
    }
  }

  const isPastMonth = Boolean(paceResult?.isPastMonth);
  const isFutureMonth = Boolean(paceResult?.isFutureMonth);

  // 🚀 PERFORMANCE ENGINE O(N): Map indexado pela chave de agregação da linha.
  // Permite busca O(1) independente das dimensões (ex: manager_id, manager_id|client, etc.), eliminando o efeito N+1.
  const pmRemainderManagerMap = new Map<string, { fat: number; qty: number; maco: number }>();
  if (paceResult?.rowsPmRemainderManager) {
    for (const r of paceResult.rowsPmRemainderManager) {
      const mId = r.manager_id || '9999';
      const existing = pmRemainderManagerMap.get(mId) || { fat: 0, qty: 0, maco: 0 };
      pmRemainderManagerMap.set(mId, {
        fat: existing.fat + Number(r.pace_fat || 0),
        qty: existing.qty + Number(r.pace_qty || 0),
        maco: existing.maco + Number(r.pace_maco || 0),
      });
    }
  }

  const pmRemainderClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
  if (paceResult?.rowsPmRemainderClient) {
    for (const r of paceResult.rowsPmRemainderClient) {
      const clientName = r.client || 'Não Mapeado';
      const existing = pmRemainderClientMap.get(clientName) || { fat: 0, qty: 0, maco: 0 };
      pmRemainderClientMap.set(clientName, {
        fat: existing.fat + Number(r.pace_fat || 0),
        qty: existing.qty + Number(r.pace_qty || 0),
        maco: existing.maco + Number(r.pace_maco || 0),
      });
    }
  }

  for (const [mId, mgrData] of Object.entries(byManagerMap)) {
    if (isPastMonth) {
      mgrData.paceFat = mgrData.fat;
      mgrData.paceQty = mgrData.qty;
      mgrData.paceMaco = mgrData.maco;
    } else if (isFutureMonth) {
      mgrData.fat = 0;
      mgrData.qty = 0;
      mgrData.maco = 0;
      const rem = pmRemainderManagerMap.get(mId) || { fat: 0, qty: 0, maco: 0 };
      mgrData.paceFat = rem.fat;
      mgrData.paceQty = rem.qty;
      mgrData.paceMaco = rem.maco;
    } else {
      const rem = pmRemainderManagerMap.get(mId) || { fat: 0, qty: 0, maco: 0 };
      mgrData.paceFat = mgrData.fat + rem.fat;
      mgrData.paceQty = mgrData.qty + rem.qty;
      mgrData.paceMaco = mgrData.maco + rem.maco;
    }
  }

  let totalPaceFat = 0;
  let totalPaceQty = 0;
  let totalPaceMaco = 0;

  for (const mgrData of Object.values(byManagerMap)) {
    totalPaceFat += mgrData.paceFat;
    totalPaceQty += mgrData.paceQty;
    totalPaceMaco += mgrData.paceMaco;
  }

  if (isFutureMonth) {
    totalFat = 0;
    totalQty = 0;
    totalMaco = 0;
  }

  const byManager = Object.entries(byManagerMap).map(([managerId, data]) => {
    const clients = Object.values(data.byClient)
      .sort((a, b) => b.fat - a.fat)
      .slice(0, 50)
      .map(c => {
        const remC = pmRemainderClientMap.get(c.client) || { fat: 0, qty: 0, maco: 0 };
        const paceFat = isPastMonth ? c.fat : (isFutureMonth ? remC.fat : c.fat + remC.fat);
        const paceQty = isPastMonth ? c.qty : (isFutureMonth ? remC.qty : c.qty + remC.qty);
        const paceMaco = isPastMonth ? c.maco : (isFutureMonth ? remC.maco : c.maco + remC.maco);
        return {
          ...c,
          fat: isFutureMonth ? 0 : c.fat,
          qty: isFutureMonth ? 0 : c.qty,
          maco: isFutureMonth ? 0 : c.maco,
          prevMonthFat: pmClientMap?.get(c.client)?.fat || 0,
          prevYearFat: pyClientMap?.get(c.client)?.fat || 0,
          paceFat,
          paceQty,
          paceMaco,
        };
      });
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
      paceFat: totalPaceFat, paceQty: totalPaceQty, paceMaco: totalPaceMaco,
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
    const cachedData = DashboardCache.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cachedData) {
      return NextResponse.json(cachedData);
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

    const curAgg = aggregateFromMV(data.rowsCur, data.investmentPct, data.rowsCurClient, pmClientMap, pyClientMap, data.paceResult);
    const pmAgg = aggregateFromMV(data.rowsPm, data.investmentPct);
    const pyAgg = aggregateFromMV(data.rowsPy, data.investmentPct);

    const payload = {
      success: true,
      current: curAgg,
      prevMonth: pmAgg,
      prevYear: pyAgg,
    };

    DashboardCache.set(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error: any) {
    return handleAuthError(error);
  }
}
