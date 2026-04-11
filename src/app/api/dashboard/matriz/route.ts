import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

// In-memory cache
const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutos

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

function escapeSqlValue(value: string | null) {
  if (!value) return "NULL";
  return "'" + value.replace(/'/g, "''") + "'";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const investmentPct = parseFloat(searchParams.get('investment') || '0') / 100;
    
    // For the history chart, we need more months. Let's get up to 12 months back if requested.
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
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    const supabase = getSupabaseClient();
    
    let queryStart = startDate;
    if (enableHistory && endDate) {
       // get last 12 months history
       const dateObj = new Date(endDate);
       dateObj.setMonth(dateObj.getMonth() - 11);
       queryStart = dateObj.toISOString().split('T')[0];
    }

    let base_filters = '';
    if (filters.manager) {
      const list = filters.manager.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND manager IN (${list})`;
    }
    if (filters.familia) {
      const list = filters.familia.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND tipo_produto IN (${list})`;
    }
    if (filters.uf) {
      const list = filters.uf.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND uf IN (${list})`;
    }
    if (filters.channel) {
      const list = filters.channel.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND channel IN (${list})`;
    }
    if (filters.product) {
      const list = filters.product.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND product IN (${list})`;
    }
    if (filters.matriz) {
      const list = filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',');
      base_filters += ` AND rede IN (${list})`;
    }

    // --- Query 1: Current Period (Matriz, Manager, Familia, Products) --- //
    let current_where = 'WHERE invoice_date IS NOT NULL' + base_filters;
    // Current period is exact start/end passed from user query 
    // unless they didn't pass it, in which case we fall back to queryStart
    if (startDate) {
        current_where += ` AND invoice_date >= ${escapeSqlValue(startDate)}`;
    } else if (queryStart) {
        current_where += ` AND invoice_date >= ${escapeSqlValue(queryStart)}`;
    }
    
    if (endDate) {
        current_where += ` AND invoice_date <= ${escapeSqlValue(endDate)}`;
    }

    const sqlCurrent = `
      WITH filtered_sales AS (
        SELECT 
          manager, rede, nome_parceiro, tipo_produto, product, invoice_date, 
          COALESCE(CAST(net_value AS numeric), 0) as net_value,
          COALESCE(CAST(quantity AS numeric), 0) as quantity,
          COALESCE(CAST(imposto AS numeric), 0) as imposto,
          COALESCE(CAST(custo_total AS numeric), 0) as custo_total,
          COALESCE(CAST(custo_frete AS numeric), 0) as custo_frete
        FROM sales
        ${current_where}
      ),
      calc_sales AS (
        SELECT *,
               (net_value * ${investmentPct}) as investimentos,
               (net_value - imposto - custo_total - custo_frete - (net_value * ${investmentPct})) as maco
        FROM filtered_sales
      ),
      totals AS (
        SELECT 
          COALESCE(SUM(net_value), 0) as fat, 
          COALESCE(SUM(quantity), 0) as qty, 
          COALESCE(SUM(maco), 0) as maco,
          COUNT(*) as record_count
        FROM calc_sales
      ),
      by_matriz AS (
        SELECT 
          COALESCE(NULLIF(rede, ''), COALESCE(NULLIF(nome_parceiro, ''), 'Não Mapeado')) as matriz,
          COALESCE(SUM(net_value), 0) as fat,
          COALESCE(SUM(quantity), 0) as qty,
          COALESCE(SUM(maco), 0) as maco
        FROM calc_sales
        GROUP BY 1
      ),
      by_matriz_final AS (
        SELECT 
          matriz, fat, qty, maco,
          CASE WHEN qty > 0 THEN fat / qty ELSE 0 END as rk_kg,
          CASE WHEN qty > 0 THEN maco / qty ELSE 0 END as maco_kg,
          0 as v_futura, 0 as devolucoes, 0 as bonif,
          ROW_NUMBER() OVER (ORDER BY fat DESC) as rank
        FROM by_matriz
        ORDER BY fat DESC
      ),
      by_manager AS (
        SELECT 
          COALESCE(NULLIF(manager, ''), 'Sem Gerente') as name,
          COALESCE(SUM(net_value), 0) as fat,
          CASE WHEN (SELECT fat FROM totals) > 0 THEN (COALESCE(SUM(net_value), 0) / (SELECT fat FROM totals)) * 100 ELSE 0 END as pct
        FROM calc_sales
        GROUP BY 1
        ORDER BY fat DESC
      ),
      by_product AS (
        SELECT 
          COALESCE(NULLIF(product, ''), 'Outros') as product,
          COALESCE(SUM(net_value), 0) as fat,
          COALESCE(SUM(quantity), 0) as qty
        FROM calc_sales
        GROUP BY 1
        ORDER BY fat DESC
        LIMIT 15
      ),
      by_familia AS (
        SELECT 
          COALESCE(NULLIF(tipo_produto, ''), 'Outros') as familia,
          COALESCE(SUM(net_value), 0) as fat,
          CASE WHEN (SELECT fat FROM totals) > 0 THEN (COALESCE(SUM(net_value), 0) / (SELECT fat FROM totals)) * 100 ELSE 0 END as pct
        FROM calc_sales
        GROUP BY 1
        ORDER BY fat DESC
      )
      SELECT 
        (SELECT row_to_json(t) FROM (SELECT fat, qty, maco, record_count FROM totals) t) as totals,
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_matriz_final t) as "byMatriz",
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_manager t) as "byManager",
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_product t) as "byProduct",
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_familia t) as "byFamilia"
    `;

    // --- Query 2: History Period (byMonth) --- //
    // Using queryStart for looking 12 months back
    let history_where = 'WHERE invoice_date IS NOT NULL' + base_filters;
    if (queryStart) history_where += ` AND invoice_date >= ${escapeSqlValue(queryStart)}`;
    if (endDate) history_where += ` AND invoice_date <= ${escapeSqlValue(endDate)}`;

    const sqlHistory = `
      WITH filtered_sales AS (
        SELECT 
          invoice_date, 
          COALESCE(CAST(net_value AS numeric), 0) as net_value,
          COALESCE(CAST(quantity AS numeric), 0) as quantity,
          COALESCE(CAST(imposto AS numeric), 0) as imposto,
          COALESCE(CAST(custo_total AS numeric), 0) as custo_total,
          COALESCE(CAST(custo_frete AS numeric), 0) as custo_frete
        FROM sales
        ${history_where}
      ),
      calc_sales AS (
        SELECT *,
               (net_value * ${investmentPct}) as investimentos,
               (net_value - imposto - custo_total - custo_frete - (net_value * ${investmentPct})) as maco
        FROM filtered_sales
      ),
      monthly AS (
        SELECT 
          SUBSTRING(CAST(invoice_date AS text), 1, 7) as month,
          COALESCE(SUM(net_value), 0) as fat,
          COALESCE(SUM(quantity), 0) as qty,
          COALESCE(SUM(maco), 0) as maco
        FROM calc_sales
        GROUP BY 1
        ORDER BY 1
      )
      SELECT COALESCE(json_agg(t), '[]'::json) as "byMonth" FROM monthly t;
    `;

    // Fire both query requests to DB in parallel
    const [resCurrent, resHistory] = await Promise.all([
        supabase.rpc('execute_readonly_query', { query_text: sqlCurrent }),
        supabase.rpc('execute_readonly_query', { query_text: sqlHistory })
    ]);

    if (resCurrent.error) throw new Error(resCurrent.error.message);
    if (resHistory.error) throw new Error(resHistory.error.message);

    const currentData = resCurrent.data && resCurrent.data.length > 0 ? resCurrent.data[0] : null;
    const historyData = resHistory.data && resHistory.data.length > 0 ? resHistory.data[0] : null;

    if (!currentData || !historyData) {
        throw new Error("No data returned from queries.");
    }

    const payload = {
      success: true,
      totals: currentData.totals,
      byMatriz: currentData.byMatriz,
      byManager: currentData.byManager,
      byProduct: currentData.byProduct,
      byFamilia: currentData.byFamilia,
      byMonth: historyData.byMonth,
      recordCount: currentData.totals?.record_count || 0,
    };
    
    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Dashboard API Matriz] Error:', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
