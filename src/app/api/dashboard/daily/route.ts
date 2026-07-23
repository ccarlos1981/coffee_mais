import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";
import { parseAnalyticsFiltersFromParams, escapeSqlValue } from "@/lib/governance/analytics";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createAdminClient();
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Dia");

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || "2026";
    const month = searchParams.get("month") || "7";

    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const hasFamilyFilter = Boolean(filters.familia && filters.familia !== 'all');

    const supabase = getSupabaseClient();

    const clauses: string[] = [];

    // Gerente / Manager
    if (filters.manager_id) {
      const managers = filters.manager_id.split(',').map(m => escapeSqlValue(m.trim())).join(',');
      clauses.push(`(
        (CASE 
          WHEN f.nome_vendedor = 'AMAZON 1P' THEN '1008'
          WHEN f.nome_vendedor = 'DISTRIBUIDOR' THEN '1007'
          WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN '1005'
          WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') THEN '1006'
          ELSE c.manager_id
        END) IN (${managers})
      )`);
    } else if (filters.manager && filters.manager !== 'all') {
      const managers = filters.manager.split(',').map(m => escapeSqlValue(m.trim())).join(',');
      clauses.push(`(
        (COALESCE(
          CASE 
            WHEN f.nome_vendedor = 'AMAZON 1P' THEN 'Amazon 1P'
            WHEN f.nome_vendedor = 'DISTRIBUIDOR' THEN 'Distribuidor'
            WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
            WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') THEN 'Marketplace'
            ELSE c.responsavel
          END, 'SEM RESPONSÁVEL'
        )) IN (${managers})
      )`);
    }

    // UF
    if (filters.uf && filters.uf !== 'all') {
      const ufs = filters.uf.split(',').map(u => escapeSqlValue(u.trim())).join(',');
      clauses.push(`(
        COALESCE(
          CASE WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU') THEN 'SP' ELSE c.uf END,
          'SP'
        ) IN (${ufs})
      )`);
    }

    // Canal
    if (filters.channel && filters.channel !== 'all') {
      const channels = filters.channel.split(',').map(ch => escapeSqlValue(ch.trim())).join(',');
      clauses.push(`(
        COALESCE(
          CASE 
            WHEN f.nome_vendedor = 'AMAZON 1P' THEN 'Amazon 1P'
            WHEN f.nome_vendedor = 'DISTRIBUIDOR' THEN 'Distribuidor'
            WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
            WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') THEN 'Marketplace'
            ELSE c.tipo_parceiro
          END, 'Outros'
        ) IN (${channels})
      )`);
    }

    // Rede / Matriz
    if (filters.matriz && filters.matriz !== 'all') {
      const redes = filters.matriz.split(',').map(r => escapeSqlValue(r.trim())).join(',');
      clauses.push(`(
        COALESCE(
          CASE 
            WHEN f.nome_vendedor = 'AMAZON 1P' THEN 'Amazon 1P'
            WHEN f.nome_vendedor = 'DISTRIBUIDOR' THEN 'Distribuidor'
            WHEN f.nome_vendedor IN ('SHOPIFY', 'LIVELO') THEN 'Ecommerce'
            WHEN f.nome_vendedor IN ('AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') THEN 'Marketplace'
            ELSE c.matriz
          END, f.nome_parceiro, 'Não Mapeado'
        ) IN (${redes})
      )`);
    }

    // Produto (SKU / Descrição)
    if (hasProductFilter) {
      const products = filters.product!.split(',').map(p => escapeSqlValue(p.trim())).join(',');
      clauses.push(`(f.desc_produto IN (${products}) OR f.desc_produto ILIKE ANY(ARRAY[${filters.product!.split(',').map(p => `'%${p.trim()}%'`).join(',')}]))`);
    }

    // Família de Produto
    if (hasFamilyFilter) {
      const familias = filters.familia!.split(',').map(f => escapeSqlValue(f.trim())).join(',');
      clauses.push(`(
        CASE
          WHEN (POSITION(('1KG'::text) IN (upper(f.desc_produto))) > 0) THEN '1 KG'::text
          WHEN ((POSITION(('5KG'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('5 KG'::text) IN (upper(f.desc_produto))) > 0)) THEN '5 KG'::text
          WHEN ((POSITION(('CAPSULA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('CÁPSULA'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Cápsula'::text
          WHEN (POSITION(('DRIP'::text) IN (upper(f.desc_produto))) > 0) THEN 'Drip'::text
          WHEN (POSITION(('GEISHA'::text) IN (upper(f.desc_produto))) > 0) THEN 'Geisha'::text
          WHEN (POSITION(('VERDE'::text) IN (upper(f.desc_produto))) > 0) THEN 'Café Verde'::text
          WHEN ((POSITION(('GRAO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('GRÃO'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Grão'::text
          WHEN ((POSITION(('MOIDO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('MOÍDO'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Moído'::text
          WHEN ((POSITION(('ACESSORIO'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('GARRAFA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('CANECA'::text) IN (upper(f.desc_produto))) > 0) OR (POSITION(('KIT'::text) IN (upper(f.desc_produto))) > 0)) THEN 'Acessório'::text
          ELSE 'Outros'::text
        END IN (${familias})
      )`);
    }

    const filterSql = clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '';

    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const sql = `
      SELECT 
        f.dt_faturamento::text as date_str,
        SUM(
          CASE 
            WHEN (f.cod_top)::numeric = ANY (ARRAY[1200, 1201]::numeric[]) THEN -ABS(COALESCE(f.vlr_total_liq, 0))
            ELSE COALESCE(f.vlr_total_liq, 0)
          END
        )::numeric as daily_fat,
        SUM(
          CASE 
            WHEN (f.cod_top)::numeric = ANY (ARRAY[1200, 1201]::numeric[]) THEN -ABS(COALESCE(f.quantidade, 0))
            ELSE COALESCE(f.quantidade, 0)
          END
        )::numeric as daily_qty
      FROM public.cm_faturamento_sankhya f
      LEFT JOIN public.cm_clientes c ON c.codigo = f.cod_parceiro::integer
      WHERE f.dt_faturamento >= '${startDateStr}' AND f.dt_faturamento <= '${endDateStr}'
        AND (f.cod_top)::numeric = ANY (ARRAY[1100, 1117, 1200, 1201, 1703, 1713, 1723]::numeric[])
        AND ((f.status_nfe IS NULL) OR (f.status_nfe <> 'CANCELADA'::text))
        AND (f.nome_parceiro <> ALL (ARRAY['CAFE UTAM S/A'::text, 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'::text]))
        ${filterSql}
      GROUP BY f.dt_faturamento::text
      ORDER BY f.dt_faturamento::text ASC
    `;

    console.log(`[Daily Dashboard API] Running query for ${year}-${month}...`);
    const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) {
      console.error("[Daily Dashboard API] Error:", error);
      throw new Error(error.message);
    }

    const dailyMap = new Map<number, { fat: number; qty: number }>();
    for (const r of (rows || [])) {
      if (r.date_str) {
        const dayNum = parseInt(r.date_str.split('-')[2], 10);
        dailyMap.set(dayNum, {
          fat: Number(r.daily_fat || 0),
          qty: Number(r.daily_qty || 0),
        });
      }
    }

    const days = Array.from({ length: lastDay }, (_, i) => {
      const dayNum = i + 1;
      const val = dailyMap.get(dayNum) || { fat: 0, qty: 0 };
      return {
        day: dayNum,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`,
        fat: val.fat,
        qty: val.qty,
      };
    });

    return NextResponse.json({
      success: true,
      data: days,
      year: Number(year),
      month: Number(month),
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
