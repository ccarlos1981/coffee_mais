import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';

// In-memory cache to dramatically speed up dashboard
const API_CACHE = new Map<string, { timestamp: number; data: unknown }>();
const CACHE_TTL = 1000 * 60 * 2; // 2 minutos

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
    const startStr = searchParams.get("startDate");
    const endStr = searchParams.get("endDate");

    let startDate, endDate;
    if (startStr && endStr) {
      startDate = `${startStr}-01`;
      const [year, month] = endStr.split("-");
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${endStr}-${String(lastDay).padStart(2, "0")}`;
    } else {
      const endYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
      const startYear = endYear - 2; // Last 3 years inclusive
      startDate = `${startYear}-01-01`;
      endDate = `${endYear}-12-31`;
    }

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
    };

    const investmentPct = parseFloat(searchParams.get("investment") || "0") / 100;

    // Check Cache First
    const cacheKey = request.url;
    const cached = API_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    let where_clause = 'WHERE manager IS NOT NULL';
    if (startDate) where_clause += ` AND invoice_date >= ${escapeSqlValue(startDate)}`;
    if (endDate) where_clause += ` AND invoice_date <= ${escapeSqlValue(endDate)}`;

    if (filters.manager && filters.manager !== 'all') {
      const list = filters.manager.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND manager IN (${list})`;
    }
    if (filters.familia && filters.familia !== 'all') {
      const list = filters.familia.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND tipo_produto IN (${list})`;
    }
    if (filters.uf && filters.uf !== 'all') {
      const list = filters.uf.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND uf IN (${list})`;
    }
    if (filters.channel && filters.channel !== 'all') {
      const list = filters.channel.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND channel IN (${list})`;
    }
    if (filters.product && filters.product !== 'all') {
      const list = filters.product.split(',').map(m => escapeSqlValue(m)).join(',');
      where_clause += ` AND product IN (${list})`;
    }

    const sql = `
    
    WITH sales_enriched AS (
      SELECT 
        b.manager, 
        b.rede, 
        f.nome_parceiro, 
        CASE 
          WHEN UPPER(f.desc_produto) LIKE '%1KG%' THEN '1 KG'
          WHEN UPPER(f.desc_produto) LIKE '%5KG%' OR UPPER(f.desc_produto) LIKE '%5 KG%' THEN '5 KG'
          WHEN UPPER(f.desc_produto) LIKE '%CAPSULA%' OR UPPER(f.desc_produto) LIKE '%CÁPSULA%' THEN 'Cápsula'
          WHEN UPPER(f.desc_produto) LIKE '%DRIP%' THEN 'Drip'
          WHEN UPPER(f.desc_produto) LIKE '%GEISHA%' THEN 'Geisha'
          WHEN UPPER(f.desc_produto) LIKE '%VERDE%' THEN 'Café Verde'
          WHEN UPPER(f.desc_produto) LIKE '%GRAO%' OR UPPER(f.desc_produto) LIKE '%GRÃO%' THEN 'Grão'
          WHEN UPPER(f.desc_produto) LIKE '%MOIDO%' OR UPPER(f.desc_produto) LIKE '%MOÍDO%' THEN 'Moído'
          WHEN UPPER(f.desc_produto) LIKE '%ACESSORIO%' OR UPPER(f.desc_produto) LIKE '%GARRAFA%' OR UPPER(f.desc_produto) LIKE '%CANECA%' OR UPPER(f.desc_produto) LIKE '%KIT%' THEN 'Acessório'
          ELSE 'Outros'
        END as tipo_produto,
        f.desc_produto as product, 
        f.dt_faturamento as invoice_date, 
        COALESCE(CAST(f.vlr_total_liq AS numeric), 0) as net_value,
        COALESCE(CAST(f.quantidade AS numeric), 0) as quantity,
        (COALESCE(CAST(f.custo_icms AS numeric), 0) + COALESCE(CAST(f.vlr_total_st AS numeric), 0)) as imposto,
        COALESCE(CAST(f.custo_total AS numeric), 0) as custo_total,
        COALESCE(CAST(f.vlr_frete AS numeric), 0) as custo_frete,
        b.uf,
        b.canal as channel
      FROM cm_faturamento_sankhya f
      JOIN base_atendimento b ON CAST(b.cod_parceiro AS TEXT) = CAST(f.cod_parceiro AS TEXT)
    ),
    filtered_sales AS (
      SELECT 
        manager, rede, nome_parceiro, tipo_produto, product, invoice_date, 
        COALESCE(CAST(net_value AS numeric), 0) as net_value,
        COALESCE(CAST(quantity AS numeric), 0) as quantity,
        COALESCE(CAST(imposto AS numeric), 0) as imposto,
        COALESCE(CAST(custo_total AS numeric), 0) as custo_total,
        COALESCE(CAST(custo_frete AS numeric), 0) as custo_frete
      FROM sales_enriched
      ${where_clause}
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
        COALESCE(SUM(maco), 0) as maco
      FROM calc_sales
    ),
    monthly AS (
      SELECT 
        SUBSTRING(CAST(invoice_date AS text), 1, 7) as "monthKey",
        SUBSTRING(CAST(invoice_date AS text), 1, 4) as year,
        COALESCE(SUM(net_value), 0) as fat,
        COALESCE(SUM(quantity), 0) as qty,
        COALESCE(SUM(maco), 0) as maco
      FROM calc_sales
      WHERE invoice_date IS NOT NULL
      GROUP BY SUBSTRING(CAST(invoice_date AS text), 1, 7), SUBSTRING(CAST(invoice_date AS text), 1, 4)
      ORDER BY 1
    ),
    by_familia AS (
      SELECT 
        COALESCE(NULLIF(tipo_produto, ''), 'Outros') as familia,
        COALESCE(SUM(net_value),0) as fat,
        COALESCE(SUM(quantity),0) as qty,
        COALESCE(SUM(maco),0) as maco
      FROM calc_sales
      GROUP BY COALESCE(NULLIF(tipo_produto, ''), 'Outros')
      ORDER BY 2 DESC
      LIMIT 10
    ),
    by_client AS (
      SELECT 
        COALESCE(NULLIF(nome_parceiro, ''), COALESCE(NULLIF(rede, ''), 'Não Mapeado')) as client,
        COALESCE(SUM(net_value),0) as fat,
        COALESCE(SUM(quantity),0) as qty,
        COALESCE(SUM(maco),0) as maco
      FROM calc_sales
      GROUP BY COALESCE(NULLIF(nome_parceiro, ''), COALESCE(NULLIF(rede, ''), 'Não Mapeado'))
      ORDER BY 2 DESC
      LIMIT 10
    )
    SELECT 
      (SELECT row_to_json(t) FROM (SELECT fat, qty, maco FROM totals) t) as totals,
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM monthly t) as "monthlyHistory",
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_familia t) as "byFamilia",
      (SELECT COALESCE(json_agg(t), '[]'::json) FROM by_client t) as "byClient"
    `;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      throw new Error(error.message);
    }

    const payload = data && data.length > 0 ? data[0] : null;

    const result = {
      success: true,
      monthlyHistory: payload?.monthlyHistory || [],
      byFamilia: payload?.byFamilia || [],
      byClient: payload?.byClient || [],
      totals: payload?.totals || { fat: 0, qty: 0, maco: 0 }
    };
    
    // Save to Cache
    API_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Dashboard history API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
