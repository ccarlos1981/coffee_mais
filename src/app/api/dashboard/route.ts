import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 5;

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
    },
  });
}

interface MvRow {
  mes: string;
  manager: string;
  rede: string;
  tipo_produto: string;
  uf: string;
  channel: string;
  fat: number;
  qty: number;
  maco: number;
  total_imposto?: number;
  total_custo?: number;
  total_frete?: number;
  num_vendas?: number;
}

interface MvClientRow {
  mes: string;
  manager: string;
  client: string;
  fat: number;
  qty: number;
  maco: number;
}

function escapeSqlValue(value: string | null) {
  if (!value) return "NULL";
  return "'" + value.replace(/'/g, "''") + "'";
}

function buildWhereClause(filters: Record<string, string | null>, startMonth: string | null, endMonth: string | null) {
  const clauses = ['1=1'];
  if (startMonth) clauses.push(`mes >= ${escapeSqlValue(startMonth)}`);
  if (endMonth) clauses.push(`mes <= ${escapeSqlValue(endMonth)}`);
  if (filters.manager) clauses.push(`manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`);
  if (filters.familia) clauses.push(`tipo_produto IN (${filters.familia.split(',').map(f => escapeSqlValue(f)).join(',')})`);
  if (filters.uf) clauses.push(`uf IN (${filters.uf.split(',').map(u => escapeSqlValue(u)).join(',')})`);
  if (filters.channel) clauses.push(`channel IN (${filters.channel.split(',').map(c => escapeSqlValue(c)).join(',')})`);
  return 'WHERE ' + clauses.join(' AND ');
}

function aggregateFromMV(
  rows: MvRow[],
  investmentPct: number,
  clientRows?: MvClientRow[],
  pmClientMap?: Map<string, { fat: number; qty: number; maco: number }>,
  pyClientMap?: Map<string, { fat: number; qty: number; maco: number }>
) {
  const byManagerMap: Record<string, {
    fat: number; qty: number; maco: number;
    paceFat: number; paceQty: number; paceMaco: number;
    byClient: Record<string, { client: string; fat: number; qty: number; maco: number }>;
  }> = {};

  const byFamiliaMap: Record<string, { fat: number; qty: number }> = {};
  let totalFat = 0, totalQty = 0, totalMaco = 0;

  for (const row of rows) {
    const m = row.manager || 'Outros';
    const familia = row.tipo_produto || 'Outros';
    const fat = Number(row.fat || 0);
    const qty = Number(row.qty || 0);
    const maco = investmentPct > 0
      ? Number(row.maco || 0) - (fat * investmentPct)
      : Number(row.maco || 0);

    totalFat += fat;
    totalQty += qty;
    totalMaco += maco;

    // Manager aggregation
    if (!byManagerMap[m]) {
      byManagerMap[m] = { fat: 0, qty: 0, maco: 0, paceFat: 0, paceQty: 0, paceMaco: 0, byClient: {} };
    }
    byManagerMap[m].fat += fat;
    byManagerMap[m].qty += qty;
    byManagerMap[m].maco += maco;

    // Familia
    if (familia !== 'Outros') {
      if (!byFamiliaMap[familia]) byFamiliaMap[familia] = { fat: 0, qty: 0 };
      byFamiliaMap[familia].fat += fat;
      byFamiliaMap[familia].qty += qty;
    }
  }

  // Populate clients from mv_vendas_cliente_mensal
  if (clientRows) {
    for (const row of clientRows) {
      const m = row.manager || 'Outros';
      const client = row.client || 'Não Mapeado';
      const fat = Number(row.fat || 0);
      const qty = Number(row.qty || 0);
      const maco = investmentPct > 0
        ? Number(row.maco || 0) - (fat * investmentPct)
        : Number(row.maco || 0);

      if (!byManagerMap[m]) {
        byManagerMap[m] = { fat: 0, qty: 0, maco: 0, paceFat: 0, paceQty: 0, paceMaco: 0, byClient: {} };
      }

      if (!byManagerMap[m].byClient[client]) {
        byManagerMap[m].byClient[client] = { client, fat: 0, qty: 0, maco: 0 };
      }
      byManagerMap[m].byClient[client].fat += fat;
      byManagerMap[m].byClient[client].qty += qty;
      byManagerMap[m].byClient[client].maco += maco;
    }
  }

  // Set initial pace = actual
  for (const mgrData of Object.values(byManagerMap)) {
    mgrData.paceFat = mgrData.fat;
    mgrData.paceQty = mgrData.qty;
    mgrData.paceMaco = mgrData.maco;
  }

  const byManager = Object.entries(byManagerMap).map(([manager, data]) => {
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
      manager,
      fat: data.fat,
      qty: data.qty,
      maco: data.maco,
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
      fat: totalFat, qty: totalQty, maco: totalMaco,
      paceFat: totalFat, paceQty: totalQty, paceMaco: totalMaco,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const investmentPct = parseFloat(searchParams.get('investment') || '0') / 100;

    const filters: Record<string, string | null> = {
      manager: searchParams.get('manager') !== 'all' ? searchParams.get('manager') : null,
      familia: searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null,
      uf: searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null,
      channel: searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null,
      product: searchParams.get('product') !== 'all' ? searchParams.get('product') : null,
    };

    const cacheKey = JSON.stringify({ ...filters, startDate, endDate, investmentPct });
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();

    // Current period month keys
    const curStartMonth = startDate ? startDate.substring(0, 7) : null;
    const curEndMonth = endDate ? endDate.substring(0, 7) : null;

    if (!curStartMonth || !curEndMonth) {
      return NextResponse.json({ success: false, error: 'Missing startDate/endDate' }, { status: 400 });
    }

    // Calculate comparison periods (previous month and previous year)
    const [sYear, sMonth] = curStartMonth.split('-').map(Number);
    const [eYear, eMonth] = curEndMonth.split('-').map(Number);

    const pmStartMonth = `${sMonth === 1 ? sYear - 1 : sYear}-${String(sMonth === 1 ? 12 : sMonth - 1).padStart(2, '0')}`;
    const pmEndMonth = `${eMonth === 1 ? eYear - 1 : eYear}-${String(eMonth === 1 ? 12 : eMonth - 1).padStart(2, '0')}`;
    const pyStartMonth = `${sYear - 1}-${String(sMonth).padStart(2, '0')}`;
    const pyEndMonth = `${eYear - 1}-${String(eMonth).padStart(2, '0')}`;

    console.log(`[Dashboard API] Period: ${curStartMonth} to ${curEndMonth}, PM: ${pmStartMonth}-${pmEndMonth}, PY: ${pyStartMonth}-${pyEndMonth}`);

    const whereClause = buildWhereClause(filters, curStartMonth, curEndMonth);
    const pmWhereClause = buildWhereClause(filters, pmStartMonth, pmEndMonth);
    const pyWhereClause = buildWhereClause(filters, pyStartMonth, pyEndMonth);

    // Build all queries in parallel using RPC
    const sqlCur = `SELECT * FROM mv_vendas_mensal ${whereClause}`;
    const sqlCurClient = `
      SELECT 
        mes,
        COALESCE(manager, 'Outros') as manager,
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco) as maco
      FROM mv_vendas_cliente_mensal
      ${whereClause}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const sqlPm = `SELECT mes, manager, fat, qty, maco FROM mv_vendas_mensal ${pmWhereClause}`;
    const sqlPmClient = `
      SELECT 
        mes,
        COALESCE(manager, 'Outros') as manager,
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco) as maco
      FROM mv_vendas_cliente_mensal
      ${pmWhereClause}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    const sqlPy = `SELECT mes, manager, fat, qty, maco FROM mv_vendas_mensal ${pyWhereClause}`;
    const sqlPyClient = `
      SELECT 
        mes,
        COALESCE(manager, 'Outros') as manager,
        COALESCE(rede, nome_parceiro, 'Não Mapeado') as client,
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco) as maco
      FROM mv_vendas_cliente_mensal
      ${pyWhereClause}
      GROUP BY mes, COALESCE(manager, 'Outros'), COALESCE(rede, nome_parceiro, 'Não Mapeado')
    `;

    console.time("Dashboard-RPC-Queries");
    const [resCur, resCurClient, resPm, resPmClient, resPy, resPyClient] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlCur }),
      supabase.rpc('execute_readonly_query', { query_text: sqlCurClient }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPm }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPmClient }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPy }),
      supabase.rpc('execute_readonly_query', { query_text: sqlPyClient }),
    ]);
    console.timeEnd("Dashboard-RPC-Queries");

    if (resCur.error) throw new Error(resCur.error.message);
    if (resCurClient.error) throw new Error(resCurClient.error.message);
    if (resPm.error) throw new Error(resPm.error.message);
    if (resPmClient.error) throw new Error(resPmClient.error.message);
    if (resPy.error) throw new Error(resPy.error.message);
    if (resPyClient.error) throw new Error(resPyClient.error.message);

    const curData = (resCur.data || []) as MvRow[];
    const curClientData = (resCurClient.data || []) as MvClientRow[];
    const pmData = (resPm.data || []) as MvRow[];
    const pmClientData = (resPmClient.data || []) as MvClientRow[];
    const pyData = (resPy.data || []) as MvRow[];
    const pyClientData = (resPyClient.data || []) as MvClientRow[];

    console.log(`[Dashboard API] MV rows: cur=${curData.length}, curClient=${curClientData.length}, pm=${pmData.length}, py=${pyData.length}`);

    // Build PM and PY client maps for comparison
    const pmClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    for (const row of pmClientData) {
      const client = row.client || 'Não Mapeado';
      const existing = pmClientMap.get(client) || { fat: 0, qty: 0, maco: 0 };
      existing.fat += Number(row.fat || 0);
      existing.qty += Number(row.qty || 0);
      existing.maco += Number(row.maco || 0);
      pmClientMap.set(client, existing);
    }

    const pyClientMap = new Map<string, { fat: number; qty: number; maco: number }>();
    for (const row of pyClientData) {
      const client = row.client || 'Não Mapeado';
      const existing = pyClientMap.get(client) || { fat: 0, qty: 0, maco: 0 };
      existing.fat += Number(row.fat || 0);
      existing.qty += Number(row.qty || 0);
      existing.maco += Number(row.maco || 0);
      pyClientMap.set(client, existing);
    }

    // PM totals
    let pmFat = 0, pmQty = 0, pmMaco = 0;
    for (const row of pmData) {
      pmFat += Number(row.fat || 0);
      pmQty += Number(row.qty || 0);
      pmMaco += Number(row.maco || 0);
    }

    // PY totals
    let pyFat = 0, pyQty = 0, pyMaco = 0;
    for (const row of pyData) {
      pyFat += Number(row.fat || 0);
      pyQty += Number(row.qty || 0);
      pyMaco += Number(row.maco || 0);
    }

    // Aggregate current period
    const aggregated = aggregateFromMV(
      curData,
      investmentPct,
      curClientData,
      pmClientMap,
      pyClientMap,
    );

    // Pace calculation: if current month, project based on day of month
    const today = new Date();
    const curMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    if (curStartMonth === curMonthStr) {
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      if (dayOfMonth < daysInMonth) {
        const projectionFactor = daysInMonth / dayOfMonth;
        aggregated.totals.paceFat = aggregated.totals.fat * projectionFactor;
        aggregated.totals.paceQty = aggregated.totals.qty * projectionFactor;
        aggregated.totals.paceMaco = aggregated.totals.maco * projectionFactor;

        for (const mgr of aggregated.byManager) {
          mgr.paceFat = mgr.fat * projectionFactor;
          mgr.paceQty = mgr.qty * projectionFactor;
          mgr.paceMaco = mgr.maco * projectionFactor;
        }
      }
    }

    const payload = {
      success: true,
      salesCount: curData.length,
      ...aggregated,
      previousMonth: { fat: pmFat, qty: pmQty, maco: pmMaco },
      previousYear: { fat: pyFat, qty: pyQty, maco: pyMaco },
      recordCount: curData.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Dashboard API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
