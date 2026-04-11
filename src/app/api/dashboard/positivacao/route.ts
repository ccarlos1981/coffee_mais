import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 15;

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
    
    let where_clause = 'WHERE invoice_date IS NOT NULL';
    if (startDate) where_clause += ` AND invoice_date >= ${escapeSqlValue(startDate)}`;
    if (endDate) where_clause += ` AND invoice_date <= ${escapeSqlValue(endDate)}`;

    if (filters.manager) {
      const list = filters.manager.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND manager IN (${list})`;
    }
    if (filters.familia) {
      const list = filters.familia.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND tipo_produto IN (${list})`;
    }
    if (filters.uf) {
      const list = filters.uf.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND uf IN (${list})`;
    }
    if (filters.channel) {
      const list = filters.channel.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND channel IN (${list})`;
    }
    if (filters.product) {
      const list = filters.product.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND product IN (${list})`;
    }
    if (filters.matriz) {
      const list = filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND rede IN (${list})`;
    }

    const sql = `
      WITH filtered_sales AS (
        SELECT 
          manager, rede, nome_parceiro, product, invoice_date, 
          COALESCE(CAST(net_value AS numeric), 0) as net_value,
          COALESCE(CAST(quantity AS numeric), 0) as quantity,
          COALESCE(NULLIF(nome_parceiro, ''), COALESCE(NULLIF(rede, ''), 'Não Mapeado')) as client,
          COALESCE(NULLIF(rede, ''), 'Não Mapeado') as matriz,
          COALESCE(NULLIF(product, ''), 'Outros') as sku,
          COALESCE(NULLIF(manager, ''), 'Sem Gerente') as manager_name,
          SUBSTRING(CAST(invoice_date AS text), 1, 7) as month_key
        FROM sales
        ${where_clause}
      ),
      totals AS (
        SELECT 
          COUNT(DISTINCT client) as clientes,
          COUNT(DISTINCT matriz) as matrizes,
          COALESCE(SUM(net_value), 0) as fat,
          COUNT(DISTINCT month_key) as meses,
          COUNT(*) as record_count
        FROM filtered_sales
      ),
      monthly_raw AS (
        SELECT 
          month_key as month,
          COUNT(DISTINCT client) as clientes,
          COUNT(DISTINCT matriz) as matrizes,
          COALESCE(SUM(net_value),0) as fat,
          COALESCE(SUM(quantity),0) as qty
        FROM filtered_sales
        GROUP BY 1
        ORDER BY 1
      ),
      sku_qty AS (
        SELECT sku, SUM(quantity) as total_qty
        FROM filtered_sales
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 20
      ),
      batalha_naval AS (
        SELECT 
          s.sku,
          s.total_qty as "totalQty",
          COALESCE((
            SELECT json_object_agg(f.month_key, (
              SELECT COUNT(DISTINCT client) FROM filtered_sales fs2 WHERE fs2.sku = s.sku AND fs2.month_key = f.month_key
            ))
            FROM (SELECT DISTINCT month_key FROM filtered_sales) f
          ), '{}'::json) as months
        FROM sku_qty s
      ),
      manager_agg AS (
        SELECT 
          manager_name as manager,
          COUNT(DISTINCT client) as clientes,
          COUNT(DISTINCT matriz) as matrizes,
          COALESCE(SUM(net_value), 0) as fat,
          COALESCE((
            SELECT json_object_agg(f.month_key, (
              SELECT COUNT(DISTINCT client) FROM filtered_sales fs3 WHERE fs3.manager_name = fs.manager_name AND fs3.month_key = f.month_key
            ))
            FROM (
               SELECT month_key FROM filtered_sales GROUP BY 1 ORDER BY 1 DESC LIMIT 12
            ) f
          ), '{}'::json) as monthly
        FROM filtered_sales fs
        GROUP BY 1
        ORDER BY 2 DESC
      )
      SELECT 
        (SELECT row_to_json(t) FROM (SELECT clientes, matrizes, fat, meses, record_count FROM totals) t) as totals,
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM monthly_raw t) as "byMonth",
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM manager_agg t) as "byManager",
        (SELECT COALESCE(json_agg(t), '[]'::json) FROM batalha_naval t) as "batalhaNaval"
    `;

    const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      throw new Error(error.message);
    }

    const payload = data && data.length > 0 ? data[0] : null;

    const byMonth = payload?.byMonth || [];
    const months = byMonth.map((m: any) => m.month);

    const result = {
      success: true,
      totals: payload?.totals || { clientes: 0, matrizes: 0, fat: 0, meses: 0 },
      byMonth,
      byManager: payload?.byManager || [],
      batalhaNaval: payload?.batalhaNaval || [],
      months,
      recordCount: payload?.totals?.record_count || 0,
    };

    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
