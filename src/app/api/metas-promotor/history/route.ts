import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireAuth,
  requireApprovedProfile,
  assertPromotorAccess,
  handleAuthError,
} from "@/lib/supabase/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);

    const { searchParams } = new URL(request.url);
    const promoterId = searchParams.get("promoter_id");
    const rede = searchParams.get("rede");
    const uf = searchParams.get("uf");

    if (!promoterId || !rede || !uf) {
      return NextResponse.json({ success: false, error: "Parâmetros incompletos." }, { status: 400 });
    }

    // Strict Object-Level Authorization: verify user has authority over target promoter
    const { promoterId: authorizedPromoterId } = await assertPromotorAccess(user.id, profile, promoterId);

    const adminClient = createAdminClient();

    const sqlQuery = `
      SELECT 
        h.id,
        h.mes,
        h.valor_anterior::numeric as valor_anterior,
        h.valor_novo::numeric as valor_novo,
        h.data_hora,
        COALESCE(emp.nome_completo, prof.role, 'Trade/Sistema') as usuario_nome
      FROM public.cm_promotor_metas_history h
      LEFT JOIN public.cm_user_profiles prof ON h.usuario = prof.id
      LEFT JOIN public.cm_promotor_perfil perf ON prof.id = perf.user_id
      LEFT JOIN public.cm_employees emp ON perf.employee_id = emp.id
      WHERE h.promotor_id = $1 
        AND UPPER(TRIM(h.rede)) = UPPER(TRIM($2))
        AND UPPER(TRIM(h.uf)) = UPPER(TRIM($3))
      ORDER BY h.data_hora DESC
    `;

    // Safely run the query replacing placeholder parameters to avoid SQL Injection
    const escapedPromoterId = `'${authorizedPromoterId.replace(/'/g, "''")}'`;
    const escapedRede = `'${rede.replace(/'/g, "''")}'`;
    const escapedUf = `'${uf.replace(/'/g, "''")}'`;

    const formattedSql = sqlQuery
      .replace("$1", escapedPromoterId)
      .replace("$2", escapedRede)
      .replace("$3", escapedUf);

    const { data, error } = await adminClient.rpc("execute_readonly_query", {
      query_text: formattedSql
    });

    if (error) {
      console.error("Error executing history query:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const historyList = (data || []).map((row: any) => ({
      id: row.id,
      usuario: row.usuario_nome,
      data: row.data_hora,
      mes: row.mes,
      valor_anterior: row.valor_anterior !== null ? parseFloat(row.valor_anterior) : null,
      valor_novo: row.valor_novo !== null ? parseFloat(row.valor_novo) : null
    }));

    return NextResponse.json({
      success: true,
      data: historyList
    });

  } catch (error: any) {
    if (
      error.message === "UNAUTHENTICATED" ||
      error.message === "NOT_FOUND" ||
      error.message?.includes("PROFILE_") ||
      error.message?.includes("ROLE_NOT_ALLOWED") ||
      error.message === "FORBIDDEN"
    ) {
      return handleAuthError(error);
    }
    console.error("[METAS PROMOTOR HISTORY GET API ERROR]", error);
    return NextResponse.json({ success: false, error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
