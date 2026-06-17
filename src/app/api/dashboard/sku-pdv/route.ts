import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// Custom where clause restricted to Grão, Moído, Cápsula, Drip, 1 KG
function buildWhereClause(filters: Record<string, string | null>, startMonth: string | null, endMonth: string | null) {
  const clauses = ['1=1'];
  if (startMonth) clauses.push(`mes >= ${escapeSqlValue(startMonth)}`);
  if (endMonth) clauses.push(`mes <= ${escapeSqlValue(endMonth)}`);
  
  if (filters.manager) clauses.push(`manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`);
  
  if (filters.familia) {
    clauses.push(`tipo_produto IN (${filters.familia.split(',').map(f => escapeSqlValue(f)).join(',')})`);
  } else {
    clauses.push(`tipo_produto IN ('Grão', 'Moído', 'Cápsula', 'Drip', '1 KG')`);
  }
  
  if (filters.uf) clauses.push(`uf IN (${filters.uf.split(',').map(u => escapeSqlValue(u)).join(',')})`);
  if (filters.channel) clauses.push(`channel IN (${filters.channel.split(',').map(c => escapeSqlValue(c)).join(',')})`);
  if (filters.matriz) clauses.push(`rede IN (${filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',')})`);
  if (filters.product) clauses.push(`product IN (${filters.product.split(',').map(p => escapeSqlValue(p)).join(',')})`);
  return 'WHERE ' + clauses.join(' AND ');
}

// Special denominator where clause (only filtered by date and product/familia)
function buildCompanyWhereClause(filters: Record<string, string | null>, startMonth: string | null, endMonth: string | null) {
  const clauses = ['1=1'];
  if (startMonth) clauses.push(`mes >= ${escapeSqlValue(startMonth)}`);
  if (endMonth) clauses.push(`mes <= ${escapeSqlValue(endMonth)}`);
  
  if (filters.familia) {
    clauses.push(`tipo_produto IN (${filters.familia.split(',').map(f => escapeSqlValue(f)).join(',')})`);
  } else {
    clauses.push(`tipo_produto IN ('Grão', 'Moído', 'Cápsula', 'Drip', '1 KG')`);
  }
  
  if (filters.product) clauses.push(`product IN (${filters.product.split(',').map(p => escapeSqlValue(p)).join(',')})`);
  return 'WHERE ' + clauses.join(' AND ');
}

interface DBTotalsRow {
  total_clients: number;
  total_matrices: number;
  total_fat: number;
  avg_skus_sold: number;
}

interface DBByMonthRow {
  month: string;
  clients: number;
  fat: number;
  avg_client_skus: number;
  company_skus: number;
  avg_skus_per_pdv: number;
}

interface DBByManagerRow {
  manager: string;
  clientes: number;
  matrizes: number;
  fat: number;
  avg_skus_sold: number;
  total_portfolio: number;
  avg_skus_per_pdv: number;
}

interface DBManagerMonthlyRow {
  manager: string;
  month: string;
  avg_skus_per_pdv: number;
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

    const supabase = getSupabaseClient();
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    const whereClause = buildWhereClause(filters, startMonth, endMonth);
    const companyWhereClause = buildCompanyWhereClause(filters, startMonth, endMonth);

    // 1. Get total portfolio denominator
    const sqlPortfolio = `
      SELECT COUNT(DISTINCT product) as total_portfolio
      FROM mv_positivacao_sku_mensal
      ${companyWhereClause}
    `;

    // 2. Get overall totals (clients, matrices, faturamento, avg SKUs sold)
    const sqlTotals = `
      WITH client_stats AS (
        SELECT 
          nome_parceiro,
          MAX(rede) as matriz,
          SUM(fat::numeric) as total_fat,
          COUNT(DISTINCT product) as skus_sold
        FROM mv_positivacao_sku_mensal
        ${whereClause}
        GROUP BY nome_parceiro
      )
      SELECT 
        COUNT(DISTINCT nome_parceiro)::integer as total_clients,
        COUNT(DISTINCT matriz)::integer as total_matrices,
        SUM(total_fat)::numeric as total_fat,
        AVG(skus_sold)::numeric as avg_skus_sold
      FROM client_stats
    `;

    // 3. Get monthly evolution of SKU penetration
    const sqlByMonth = `
      WITH monthly_company AS (
        SELECT mes, COUNT(DISTINCT product) as company_skus
        FROM mv_positivacao_sku_mensal
        ${companyWhereClause}
        GROUP BY mes
      ),
      monthly_client AS (
        SELECT 
          mes, 
          nome_parceiro,
          COUNT(DISTINCT product) as client_skus,
          SUM(fat::numeric) as fat
        FROM mv_positivacao_sku_mensal
        ${whereClause}
        GROUP BY mes, nome_parceiro
      )
      SELECT 
        c.mes as month,
        COUNT(DISTINCT c.nome_parceiro)::integer as clients,
        SUM(c.fat)::numeric as fat,
        AVG(c.client_skus)::numeric as avg_client_skus,
        MAX(co.company_skus)::integer as company_skus,
        ROUND(AVG(c.client_skus)::numeric, 2)::numeric as avg_skus_per_pdv
      FROM monthly_client c
      JOIN monthly_company co ON c.mes = co.mes
      GROUP BY c.mes
      ORDER BY c.mes
    `;

    // 4. Get stats grouped by Manager
    const sqlByManager = `
      WITH company_portfolio AS (
        SELECT COUNT(DISTINCT product) as total_portfolio
        FROM mv_positivacao_sku_mensal
        ${companyWhereClause}
      ),
      client_stats AS (
        SELECT 
          nome_parceiro,
          COALESCE(manager, 'Outros') as manager,
          MAX(rede) as matriz,
          SUM(fat::numeric) as fat,
          COUNT(DISTINCT product) as skus_sold
        FROM mv_positivacao_sku_mensal
        ${whereClause}
        GROUP BY nome_parceiro, COALESCE(manager, 'Outros')
      )
      SELECT 
        manager,
        COUNT(DISTINCT nome_parceiro)::integer as clientes,
        COUNT(DISTINCT matriz)::integer as matrizes,
        SUM(fat)::numeric as fat,
        AVG(skus_sold)::numeric as avg_skus_sold,
        (SELECT total_portfolio FROM company_portfolio)::integer as total_portfolio,
        ROUND(AVG(skus_sold)::numeric, 2)::numeric as avg_skus_per_pdv
      FROM client_stats
      GROUP BY manager
    `;

    // 5. Get manager monthly evolution
    const sqlManagerMonthly = `
      WITH monthly_company AS (
        SELECT mes, COUNT(DISTINCT product) as company_skus
        FROM mv_positivacao_sku_mensal
        ${companyWhereClause}
        GROUP BY mes
      ),
      monthly_client AS (
        SELECT 
          mes, 
          COALESCE(manager, 'Outros') as manager,
          nome_parceiro,
          COUNT(DISTINCT product) as client_skus
        FROM mv_positivacao_sku_mensal
        ${whereClause}
        GROUP BY mes, COALESCE(manager, 'Outros'), nome_parceiro
      )
      SELECT 
        c.manager,
        c.mes as month,
        ROUND(AVG(c.client_skus)::numeric, 2)::numeric as avg_skus_per_pdv
      FROM monthly_client c
      JOIN monthly_company co ON c.mes = co.mes
      GROUP BY c.manager, c.mes
    `;

    console.log('[SKU por PDV API] Fetching metrics sequentially...');
    const resPortfolio = await supabase.rpc('execute_readonly_query', { query_text: sqlPortfolio });
    if (resPortfolio.error) throw new Error(resPortfolio.error.message);

    const resTotals = await supabase.rpc('execute_readonly_query', { query_text: sqlTotals });
    if (resTotals.error) throw new Error(resTotals.error.message);

    const resByMonth = await supabase.rpc('execute_readonly_query', { query_text: sqlByMonth });
    if (resByMonth.error) throw new Error(resByMonth.error.message);

    const resByManager = await supabase.rpc('execute_readonly_query', { query_text: sqlByManager });
    if (resByManager.error) throw new Error(resByManager.error.message);

    const resManagerMonthly = await supabase.rpc('execute_readonly_query', { query_text: sqlManagerMonthly });
    if (resManagerMonthly.error) throw new Error(resManagerMonthly.error.message);

    const totalPortfolio = Number(resPortfolio.data?.[0]?.total_portfolio || 0);
    const totalsRow = (resTotals.data?.[0] || { total_clients: 0, total_matrices: 0, total_fat: 0, avg_skus_sold: 0 }) as DBTotalsRow;
    
    const totals = {
      clientes: Number(totalsRow.total_clients || 0),
      matrizes: Number(totalsRow.total_matrices || 0),
      fat: Number(totalsRow.total_fat || 0),
      total_portfolio: totalPortfolio,
      avg_skus_per_pdv: Number(totalsRow.avg_skus_sold || 0)
    };

    const byMonthRows = (resByMonth.data || []) as DBByMonthRow[];
    const byMonth = byMonthRows.map(r => ({
      month: r.month,
      clientes: Number(r.clients || 0),
      fat: Number(r.fat || 0),
      avg_skus_per_pdv: Number(r.avg_skus_per_pdv || 0),
      company_skus: Number(r.company_skus || 0)
    }));

    const months = byMonth.map(m => m.month);

    const managerMonthlyRows = (resManagerMonthly.data || []) as DBManagerMonthlyRow[];
    const managerMonthlyMap = new Map<string, Record<string, number>>();
    for (const r of managerMonthlyRows) {
      const mgr = r.manager || 'Outros';
      const month = r.month;
      const val = Number(r.avg_skus_per_pdv || 0);
      if (!managerMonthlyMap.has(mgr)) {
        managerMonthlyMap.set(mgr, {});
      }
      managerMonthlyMap.get(mgr)![month] = val;
    }

    const byManagerRows = (resByManager.data || []) as DBByManagerRow[];
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
        avg_skus_per_pdv: Number(r.avg_skus_per_pdv || 0),
        monthly: monthlyObj
      };
    }).sort((a, b) => b.avg_skus_per_pdv - a.avg_skus_per_pdv); // Sort by highest average

    return NextResponse.json({
      success: true,
      totals,
      byMonth,
      byManager,
      months
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SKU por PDV API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
