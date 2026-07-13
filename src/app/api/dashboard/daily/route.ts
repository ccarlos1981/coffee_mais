import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission, handleAuthError } from "@/lib/supabase/auth-helpers";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  return createAdminClient();
}

function escapeSqlValue(value: string | null) {
  if (!value) return "NULL";
  return "'" + value.replace(/'/g, "''") + "'";
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Dia");

    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || "2026";
    const month = searchParams.get("month") || "6";

    const filters = {
      manager: searchParams.get("manager"),
      familia: searchParams.get("familia"),
      uf: searchParams.get("uf"),
      channel: searchParams.get("channel"),
      product: searchParams.get("product"),
      matriz: searchParams.get("matriz"),
    };

    const hasProductFilter = filters.product && filters.product !== 'all' && filters.product.length > 0;
    const hasFamilyFilter = filters.familia && filters.familia !== 'all' && filters.familia.length > 0;

    const supabase = getSupabaseClient();

    let filterSql = '';
    if (filters.manager && filters.manager !== 'all') {
      filterSql += ` AND a.manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.uf && filters.uf !== 'all') {
      filterSql += ` AND a.uf IN (${filters.uf.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.channel && filters.channel !== 'all') {
      filterSql += ` AND a.canal IN (${filters.channel.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (filters.matriz && filters.matriz !== 'all') {
      filterSql += ` AND a.rede IN (${filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (hasProductFilter) {
      filterSql += ` AND f.cod_produto IN (${filters.product!.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }
    if (hasFamilyFilter) {
      filterSql += ` AND p.type IN (${filters.familia!.split(',').map(m => escapeSqlValue(m)).join(',')})`;
    }

    // Determine correct end date of month
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let joinProductSql = '';
    if (hasFamilyFilter) {
      joinProductSql = `LEFT JOIN products p ON f.cod_produto = CAST(p.id AS text)`;
    }

    const sql = `
      SELECT 
        f.dt_faturamento::text as date_str,
        SUM(
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(f.vlr_total_liq, 0))
            ELSE COALESCE(f.vlr_total_liq, 0)
          END
        ) as fat,
        SUM(
          CASE 
            WHEN f.cod_top IN ('1200', '1201') THEN -ABS(COALESCE(f.quantidade, 0))
            ELSE COALESCE(f.quantidade, 0)
          END
        ) as qty
      FROM cm_faturamento_sankhya f
      LEFT JOIN base_atendimento a ON f.cod_parceiro = a.cod_parceiro
      ${joinProductSql}
      WHERE f.dt_faturamento >= '${startDateStr}' AND f.dt_faturamento <= '${endDateStr}'
        AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
        AND f.nome_parceiro != 'CAFE UTAM S/A'
        AND f.nome_parceiro != 'COFFEE MAIS INDUSTRIA DE CAFE LTDA'
        AND (
          -- Canais Digitais (Ecommerce e Marketplace)
          (f.nome_vendedor IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI') 
           AND f.cod_top::numeric IN (1100, 1200, 1201, 1723, 1117, 1703))
          OR
          -- Canais B2B e outros
          (f.nome_vendedor NOT IN ('SHOPIFY', 'LIVELO', 'AMAZONFBA', 'MELI FULL', 'SHOPEE', 'AMAZONBR', 'ANYMARKET', 'MAGALU', 'MELI')
           AND f.cod_top::numeric IN (1100, 1200, 1201, 1713, 1117, 1703)
           AND (a.manager IS NULL OR a.manager NOT IN ('Ecommerce', 'Marketplace')))
        )
        ${filterSql}
      GROUP BY f.dt_faturamento
      ORDER BY f.dt_faturamento
    `;

    console.log(`[Daily API] Querying ${startDateStr} to ${endDateStr}`);
    const { data: rows, error } = await supabase.rpc('execute_readonly_query', { query_text: sql });

    if (error) throw new Error(error.message);

    // Shape results to include every day of the month
    const dailyMap = new Map<number, { fat: number; qty: number }>();
    for (const row of (rows || [])) {
      const dayNum = Number(row.date_str.split('-')[2]);
      dailyMap.set(dayNum, {
        fat: Number(row.fat || 0),
        qty: Number(row.qty || 0),
      });
    }

    const result = [];
    for (let day = 1; day <= lastDay; day++) {
      const dataForDay = dailyMap.get(day) || { fat: 0, qty: 0 };
      result.push({
        day,
        label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
        fat: dataForDay.fat,
        qty: dataForDay.qty,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      year,
      month,
    });
  } catch (error: any) {
    return handleAuthError(error);
  }
}
