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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const selectedManager = searchParams.get('manager');
    const type = searchParams.get('type') || 'client'; // 'client' or 'matriz'
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.max(1, Number(searchParams.get('limit') || 10));
    const offset = (page - 1) * limit;

    if (!selectedManager) {
      return NextResponse.json({ success: false, error: 'Manager parameter is required' }, { status: 400 });
    }

    const filters: Record<string, string | null> = {
      manager: searchParams.get('filterManager') !== 'all' ? searchParams.get('filterManager') : null,
      familia: searchParams.get('familia') !== 'all' ? searchParams.get('familia') : null,
      uf: searchParams.get('uf') !== 'all' ? searchParams.get('uf') : null,
      channel: searchParams.get('channel') !== 'all' ? searchParams.get('channel') : null,
      product: searchParams.get('product') !== 'all' ? searchParams.get('product') : null,
      matriz: searchParams.get('matriz') !== 'all' ? searchParams.get('matriz') : null,
    };

    const supabase = getSupabaseClient();
    const startMonth = startDate ? startDate.substring(0, 7) : null;
    const endMonth = endDate ? endDate.substring(0, 7) : null;

    const clientTable = filters.product ? 'mv_positivacao_sku_mensal' : 'mv_vendas_cliente_mensal';
    const baseWhere = buildWhereClause(filters, startMonth, endMonth);
    const managerCond = selectedManager === 'Outros' 
      ? "COALESCE(manager, 'Outros') = 'Outros'" 
      : `manager = ${escapeSqlValue(selectedManager)}`;
    
    const whereClause = `${baseWhere} AND ${managerCond}`;
    const targetColumn = type === 'matriz' ? 'rede' : 'nome_parceiro';

    // 1. Get total distinct count
    const sqlCount = `
      SELECT COUNT(DISTINCT ${targetColumn}) as total
      FROM ${clientTable}
      ${whereClause}
    `;

    console.log(`[Positivação Detail API] Querying count for ${selectedManager} (${type})...`);
    const countRes = await supabase.rpc('execute_readonly_query', { query_text: sqlCount });
    if (countRes.error) throw new Error(countRes.error.message);
    const totalCount = Number(countRes.data?.[0]?.total || 0);

    if (totalCount === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        page,
        limit,
      });
    }

      // 2. Get paginated page of names
    const sqlNames = type === 'client'
      ? `
        SELECT nome_parceiro as name, MAX(rede) as matriz, MAX(uf) as uf, SUM(fat) as total_fat
        FROM ${clientTable}
        ${whereClause}
        GROUP BY nome_parceiro
        ORDER BY total_fat DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `
      : `
        SELECT rede as name, SUM(fat) as total_fat
        FROM ${clientTable}
        ${whereClause}
        GROUP BY rede
        ORDER BY total_fat DESC NULLS LAST, name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;
    const namesRes = await supabase.rpc('execute_readonly_query', { query_text: sqlNames });
    if (namesRes.error) throw new Error(namesRes.error.message);
    const namesList: { name: string; matriz?: string; uf?: string; total_fat?: string | number }[] = namesRes.data || [];

    if (namesList.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: totalCount,
        page,
        limit,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      });
    }

    const namesOnly = namesList.map(r => r.name);

    // 3. Get positive months for these specific names
    const sqlDetails = `
      SELECT DISTINCT
        ${targetColumn} as name,
        mes as month
      FROM ${clientTable}
      ${whereClause} AND ${targetColumn} IN (${namesOnly.map(escapeSqlValue).join(',')})
    `;
    const detailsRes = await supabase.rpc('execute_readonly_query', { query_text: sqlDetails });
    if (detailsRes.error) throw new Error(detailsRes.error.message);
    const detailsRows: { name: string; month: string }[] = detailsRes.data || [];

    // Group details by name
    const positiveMap = new Map<string, Set<string>>();
    for (const r of detailsRows) {
      if (!positiveMap.has(r.name)) {
        positiveMap.set(r.name, new Set());
      }
      positiveMap.get(r.name)!.add(r.month);
    }

    // Format output
    const data = namesList.map(r => {
      const activeMonths = positiveMap.get(r.name) || new Set<string>();
      return {
        name: r.name,
        matriz: r.matriz || null,
        uf: r.uf || null,
        total_fat: typeof r.total_fat === 'string' ? parseFloat(r.total_fat) : (r.total_fat || 0),
        months: Array.from(activeMonths),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      total: totalCount,
      page,
      limit,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Positivação Detail API] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
