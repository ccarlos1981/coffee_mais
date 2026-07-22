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
    const month = searchParams.get("month") || "6";

    const filters = parseAnalyticsFiltersFromParams(searchParams);

    const hasProductFilter = Boolean(filters.product && filters.product !== 'all');
    const hasFamilyFilter = Boolean(filters.familia && filters.familia !== 'all');

    const supabase = getSupabaseClient();

    const clauses: string[] = [];
    if (filters.manager_id) {
      clauses.push(`a.manager_id IN (${filters.manager_id.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    } else if (filters.manager && filters.manager !== 'all') {
      clauses.push(`a.manager IN (${filters.manager.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    }
    if (filters.uf && filters.uf !== 'all') {
      clauses.push(`a.uf IN (${filters.uf.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    }
    if (filters.channel && filters.channel !== 'all') {
      clauses.push(`a.canal IN (${filters.channel.split(',').map(c => escapeSqlValue(c)).join(',')})`);
    }
    if (filters.matriz && filters.matriz !== 'all') {
      clauses.push(`a.rede IN (${filters.matriz.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    }
    if (hasProductFilter) {
      clauses.push(`f.cod_produto IN (${filters.product!.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    }
    if (hasFamilyFilter) {
      clauses.push(`p.type IN (${filters.familia!.split(',').map(m => escapeSqlValue(m)).join(',')})`);
    }

    const filterSql = clauses.length > 0 ? ' AND ' + clauses.join(' AND ') : '';

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
            WHEN f.top IN (1200, 1201) THEN -ABS(f.vlr_total_liq)
            ELSE f.vlr_total_liq
          END
        )::numeric as daily_fat,
        SUM(f.qtd_neg)::numeric as daily_qty
      FROM cm_faturamento_sankhya f
      LEFT JOIN base_atendimento a ON f.cod_parceiro = a.cod_parceiro
      ${joinProductSql}
      WHERE f.dt_faturamento >= '${startDateStr}' AND f.dt_faturamento <= '${endDateStr}'
        AND f.top IN (1100, 1117, 1200, 1201, 1703, 1713, 1723)
        AND (f.status_nfe IS NULL OR f.status_nfe != 'CANCELADA')
        AND (f.top != 1701 AND f.cod_parceiro != 99999)
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

    const totalFat = days.reduce((sum, d) => sum + d.fat, 0);
    const totalQty = days.reduce((sum, d) => sum + d.qty, 0);

    let accum = 0;
    const daysWithAccum = days.map(d => {
      accum += d.fat;
      return {
        ...d,
        accumFat: accum,
      };
    });

    return NextResponse.json({
      success: true,
      year: Number(year),
      month: Number(month),
      totalDays: lastDay,
      totals: {
        fat: totalFat,
        qty: totalQty,
      },
      days: daysWithAccum,
    });

  } catch (error: any) {
    return handleAuthError(error);
  }
}
