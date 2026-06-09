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

function escapeSqlValue(value: string | null) {
  if (!value) return "NULL";
  return "'" + value.replace(/'/g, "''") + "'";
}

function buildWhereClause(filters: Record<string, string | null>, startMonth: string | null, endMonth: string | null, tableAlias?: string) {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  const clauses = ['1=1'];
  if (startMonth) clauses.push(`${prefix}mes >= ${escapeSqlValue(startMonth)}`);
  if (endMonth) clauses.push(`${prefix}mes <= ${escapeSqlValue(endMonth)}`);
  if (filters.manager) clauses.push(`${prefix}manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`);
  if (filters.familia) clauses.push(`${prefix}tipo_produto IN (${filters.familia.split(',').map(f => escapeSqlValue(f)).join(',')})`);
  if (filters.uf) clauses.push(`${prefix}uf IN (${filters.uf.split(',').map(u => escapeSqlValue(u)).join(',')})`);
  if (filters.channel) clauses.push(`${prefix}channel IN (${filters.channel.split(',').map(c => escapeSqlValue(c)).join(',')})`);
  if (filters.matriz) clauses.push(`${prefix}rede IN (${filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',')})`);
  if (filters.product) clauses.push(`${prefix}product IN (${filters.product.split(',').map(p => escapeSqlValue(p)).join(',')})`);
  return 'WHERE ' + clauses.join(' AND ');
}

interface DBTotalsRow {
  clientes: number;
  matrizes: number;
  fat: number;
  meses: number;
}

interface DBByMonthRow {
  month: string;
  clientes: number;
  matrizes: number;
  fat: number;
  qty: number;
}

interface DBByManagerRow {
  manager: string;
  clientes: number;
  matrizes: number;
  fat: number;
}

interface DBManagerMonthlyRow {
  manager: string;
  month: string;
  clientes: number;
}

interface DBTopSkuRow {
  sku: string;
  total_qty: number;
}

interface DBBatalhaNavalMonthlyRow {
  sku: string;
  month: string;
  clientes: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filters: Record<string, string | null> = {
      manager: searchParams.get('manager') !== 'all' ? searchParams.get('manager') : null,
      familia: searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null,
      uf: searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null,
      channel: searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null,
      product: searchParams.get('product') !== 'all' ? searchParams.get('product') : null,
      matriz: searchParams.get('matriz') !== 'all' ? searchParams.get('matriz') : null,
    };

    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    const clientTable = filters.product ? 'mv_positivacao_sku_mensal' : 'mv_vendas_cliente_mensal';
    const whereClause = buildWhereClause(filters, startMonth, endMonth);

    const sqlTotals = `
      SELECT 
        COUNT(DISTINCT nome_parceiro) as clientes,
        COUNT(DISTINCT rede) as matrizes,
        SUM(fat) as fat,
        COUNT(DISTINCT mes) as meses
      FROM ${clientTable}
      ${whereClause}
    `;

    const sqlByMonth = `
      SELECT 
        mes as month,
        COUNT(DISTINCT nome_parceiro) as clientes,
        COUNT(DISTINCT rede) as matrizes,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM ${clientTable}
      ${whereClause}
      GROUP BY mes
      ORDER BY mes
    `;

    const sqlByManager = `
      SELECT 
        COALESCE(manager, 'Outros') as manager,
        COUNT(DISTINCT nome_parceiro) as clientes,
        COUNT(DISTINCT rede) as matrizes,
        SUM(fat) as fat
      FROM ${clientTable}
      ${whereClause}
      GROUP BY COALESCE(manager, 'Outros')
    `;

    const sqlManagerMonthly = `
      SELECT 
        COALESCE(manager, 'Outros') as manager,
        mes as month,
        COUNT(DISTINCT nome_parceiro) as clientes
      FROM ${clientTable}
      ${whereClause}
      GROUP BY COALESCE(manager, 'Outros'), mes
    `;

    const sqlTop20Skus = `
      SELECT 
        product as sku,
        SUM(qty) as total_qty
      FROM mv_positivacao_sku_mensal
      ${whereClause}
      GROUP BY product
      ORDER BY total_qty DESC
      LIMIT 20
    `;

    console.log(`[Positivação API] Running Step 1 parallel aggregations...`);
    const [resTotals, resByMonth, resByManager, resManagerMonthly, resTopSkus] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlTotals }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByMonth }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByManager }),
      supabase.rpc('execute_readonly_query', { query_text: sqlManagerMonthly }),
      supabase.rpc('execute_readonly_query', { query_text: sqlTop20Skus }),
    ]);

    if (resTotals.error) throw new Error(resTotals.error.message);
    if (resByMonth.error) throw new Error(resByMonth.error.message);
    if (resByManager.error) throw new Error(resByManager.error.message);
    if (resManagerMonthly.error) throw new Error(resManagerMonthly.error.message);
    if (resTopSkus.error) throw new Error(resTopSkus.error.message);

    const totalsRows = (resTotals.data || []) as DBTotalsRow[];
    const byMonthRows = (resByMonth.data || []) as DBByMonthRow[];
    const byManagerRows = (resByManager.data || []) as DBByManagerRow[];
    const managerMonthlyRows = (resManagerMonthly.data || []) as DBManagerMonthlyRow[];
    const topSkusRows = (resTopSkus.data || []) as DBTopSkuRow[];

    const topSkusList = topSkusRows.map(r => r.sku);
    let batalhaNavalMonthlyRows: DBBatalhaNavalMonthlyRow[] = [];

    if (topSkusList.length > 0) {
      const sqlBatalhaNavalMonthly = `
        SELECT 
          product as sku,
          mes as month,
          COUNT(DISTINCT nome_parceiro) as clientes
        FROM mv_positivacao_sku_mensal
        ${whereClause} AND product IN (${topSkusList.map(s => escapeSqlValue(s)).join(',')})
        GROUP BY product, mes
      `;
      console.log(`[Positivação API] Running Step 2 Batalha Naval query for ${topSkusList.length} SKUs...`);
      const resBatalhaNaval = await supabase.rpc('execute_readonly_query', { query_text: sqlBatalhaNavalMonthly });
      if (resBatalhaNaval.error) throw new Error(resBatalhaNaval.error.message);
      batalhaNavalMonthlyRows = (resBatalhaNaval.data || []) as DBBatalhaNavalMonthlyRow[];
    }

    // Totals
    const totalsRow = totalsRows[0] || { clientes: 0, matrizes: 0, fat: 0, meses: 0 };
    const totals = {
      clientes: Number(totalsRow.clientes || 0),
      matrizes: Number(totalsRow.matrizes || 0),
      fat: Number(totalsRow.fat || 0),
      meses: Number(totalsRow.meses || 0),
    };

    // By Month
    const byMonth = byMonthRows.map(r => ({
      month: r.month,
      clientes: Number(r.clientes || 0),
      matrizes: Number(r.matrizes || 0),
      fat: Number(r.fat || 0),
      qty: Number(r.qty || 0),
    }));

    const months = byMonth.map(m => m.month);

    // By Manager
    const managerMonthlyMap = new Map<string, Record<string, number>>();
    for (const row of managerMonthlyRows) {
      const mgr = row.manager || 'Outros';
      const month = row.month;
      const count = Number(row.clientes || 0);
      if (!managerMonthlyMap.has(mgr)) {
        managerMonthlyMap.set(mgr, {});
      }
      managerMonthlyMap.get(mgr)![month] = count;
    }

    const byManager = byManagerRows.map(r => {
      const mgr = r.manager || 'Outros';
      const monthlyObj: Record<string, number> = {};
      for (const m of months) {
        monthlyObj[m] = managerMonthlyMap.get(mgr)?.[m] || 0;
      }
      return {
        manager: mgr,
        clientes: Number(r.clientes || 0),
        matrizes: Number(r.matrizes || 0),
        fat: Number(r.fat || 0),
        monthly: monthlyObj,
      };
    }).sort((a, b) => b.clientes - a.clientes);

    // Batalha Naval SKUs
    const skuMonthlyMap = new Map<string, Record<string, number>>();
    for (const row of batalhaNavalMonthlyRows) {
      const sku = row.sku;
      const month = row.month;
      const count = Number(row.clientes || 0);
      if (!skuMonthlyMap.has(sku)) {
        skuMonthlyMap.set(sku, {});
      }
      skuMonthlyMap.get(sku)![month] = count;
    }

    const topSkus = topSkusRows.map(r => ({
      sku: r.sku,
      totalQty: Number(r.total_qty || 0),
    }));

    const batalhaNaval = topSkus.map(s => {
      const skuMonthsObj: Record<string, number> = {};
      for (const m of months) {
        skuMonthsObj[m] = skuMonthlyMap.get(s.sku)?.[m] || 0;
      }
      return {
        sku: s.sku,
        totalQty: s.totalQty,
        months: skuMonthsObj,
      };
    });

    const result = {
      success: true,
      totals,
      byMonth,
      byManager,
      batalhaNaval,
      months,
      recordCount: byMonth.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
