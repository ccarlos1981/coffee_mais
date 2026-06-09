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
  fat: number;
  qty: number;
  maco: number;
}

interface DBByMatrizRow {
  matriz: string;
  fat: number;
  qty: number;
  maco: number;
}

interface DBByManagerRow {
  name: string;
  fat: number;
}

interface DBByFamiliaRow {
  familia: string;
  fat: number;
}

interface DBByMonthRow {
  month: string;
  fat: number;
  qty: number;
  maco: number;
}

interface DBByProductRow {
  product: string;
  fat: number;
  qty: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const investmentPct = parseFloat(searchParams.get('investment') || '0') / 100;
    const enableHistory = searchParams.get('history') === 'true';

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

    // Convert dates to month keys (YYYY-MM)
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    // History: get last 12 months if enabled
    let historyStartMonth = startMonth;
    if (enableHistory && endDate) {
      const dateObj = new Date(endDate);
      dateObj.setMonth(dateObj.getMonth() - 11);
      historyStartMonth = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    }

    const whereClause = buildWhereClause(filters, startMonth, endMonth);
    const historyWhereClause = buildWhereClause(filters, historyStartMonth, endMonth);

    const sqlTotals = `
      SELECT 
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco - fat * ${investmentPct}) as maco
      FROM mv_vendas_mensal
      ${whereClause}
    `;

    const sqlByMatriz = `
      SELECT 
        COALESCE(rede, 'Não Mapeado') as matriz,
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco - fat * ${investmentPct}) as maco
      FROM mv_vendas_mensal
      ${whereClause}
      GROUP BY COALESCE(rede, 'Não Mapeado')
    `;

    const sqlByManager = `
      SELECT 
        COALESCE(manager, 'Outros') as name,
        SUM(fat) as fat
      FROM mv_vendas_mensal
      ${whereClause}
      GROUP BY COALESCE(manager, 'Outros')
    `;

    const sqlByFamilia = `
      SELECT 
        COALESCE(tipo_produto, 'Outros') as familia,
        SUM(fat) as fat
      FROM mv_vendas_mensal
      ${whereClause}
      GROUP BY COALESCE(tipo_produto, 'Outros')
    `;

    const sqlByMonth = `
      SELECT 
        mes as month,
        SUM(fat) as fat,
        SUM(qty) as qty,
        SUM(maco - fat * ${investmentPct}) as maco
      FROM mv_vendas_mensal
      ${historyWhereClause}
      GROUP BY mes
      ORDER BY mes
    `;

    const sqlByProduct = `
      SELECT 
        product,
        SUM(fat) as fat,
        SUM(qty) as qty
      FROM mv_positivacao_sku_mensal
      ${whereClause}
      GROUP BY product
      ORDER BY fat DESC
      LIMIT 15
    `;

    console.log(`[Matriz API] Running parallel database aggregations...`);
    const [resTotals, resByMatriz, resByManager, resByFamilia, resByMonth, resProduct] = await Promise.all([
      supabase.rpc('execute_readonly_query', { query_text: sqlTotals }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByMatriz }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByManager }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByFamilia }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByMonth }),
      supabase.rpc('execute_readonly_query', { query_text: sqlByProduct }),
    ]);

    if (resTotals.error) throw new Error(resTotals.error.message);
    if (resByMatriz.error) throw new Error(resByMatriz.error.message);
    if (resByManager.error) throw new Error(resByManager.error.message);
    if (resByFamilia.error) throw new Error(resByFamilia.error.message);
    if (resByMonth.error) throw new Error(resByMonth.error.message);
    if (resProduct.error) throw new Error(resProduct.error.message);

    const totalsRows = (resTotals.data || []) as DBTotalsRow[];
    const byMatrizRows = (resByMatriz.data || []) as DBByMatrizRow[];
    const byManagerRows = (resByManager.data || []) as DBByManagerRow[];
    const byFamiliaRows = (resByFamilia.data || []) as DBByFamiliaRow[];
    const byMonthRows = (resByMonth.data || []) as DBByMonthRow[];
    const productRows = (resProduct.data || []) as DBByProductRow[];

    // Totals
    const totalsRow = totalsRows[0] || { fat: 0, qty: 0, maco: 0 };
    const totals = {
      fat: Number(totalsRow.fat || 0),
      qty: Number(totalsRow.qty || 0),
      maco: Number(totalsRow.maco || 0),
      record_count: byMatrizRows.length,
    };
    const totalFat = totals.fat;

    // By Matriz
    const byMatriz = byMatrizRows
      .map((row, i) => {
        const fat = Number(row.fat || 0);
        const qty = Number(row.qty || 0);
        const maco = Number(row.maco || 0);
        return {
          matriz: row.matriz,
          fat,
          qty,
          maco,
          rk_kg: qty > 0 ? fat / qty : 0,
          maco_kg: qty > 0 ? maco / qty : 0,
          v_futura: 0,
          devolucoes: 0,
          bonif: 0,
          rank: i + 1,
        };
      })
      .sort((a, b) => b.fat - a.fat)
      .map((item, i) => ({ ...item, rank: i + 1 }));

    // By Manager
    const byManager = byManagerRows
      .map(row => {
        const fat = Number(row.fat || 0);
        return {
          name: row.name || 'Outros',
          fat,
          pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
        };
      })
      .sort((a, b) => b.fat - a.fat);

    // By Familia
    const byFamilia = byFamiliaRows
      .map(row => {
        const fat = Number(row.fat || 0);
        return {
          familia: row.familia || 'Outros',
          fat,
          pct: totalFat > 0 ? (fat / totalFat) * 100 : 0,
        };
      })
      .sort((a, b) => b.fat - a.fat);

    // By Month
    const byMonth = byMonthRows
      .map(row => ({
        month: row.month,
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
        maco: Number(row.maco || 0),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // By Product (Top 15 SKUs)
    const byProduct = productRows
      .map(row => ({
        product: row.product || 'Outros',
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
      }))
      .sort((a, b) => b.fat - a.fat);

    const payload = {
      success: true,
      totals,
      byMatriz,
      byManager,
      byProduct,
      byFamilia,
      byMonth,
      recordCount: byMatrizRows.length,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Dashboard API Matriz] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
