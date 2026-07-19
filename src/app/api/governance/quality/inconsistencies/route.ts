import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { parseInconsistencyQueryParams } from "@/lib/governance/validation";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { page, limit, tipo_inconsistencia, search } = parseInconsistencyQueryParams(req);

    // 1. Iniciar query na Materialized View
    let query = supabase
      .from("mv_cadastros_inconsistentes")
      .select("*", { count: "exact" });

    // 2. Aplicar filtros
    if (tipo_inconsistencia) {
      query = query.eq("tipo_inconsistencia", tipo_inconsistencia);
    }
    if (search) {
      query = query.ilike("nome_parceiro", `%${search}%`);
    }

    // 3. Paginação
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to).order("cliente_codigo", { ascending: true });

    const { data: inconsistencies, count, error } = await query;

    if (error) {
      throw error;
    }

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / limit);

    return successResponse(inconsistencies || [], {
      pagination: {
        page,
        limit,
        total_records: totalRecords,
        total_pages: totalPages
      }
    });
  } catch (err: any) {
    const msg = err.message || "";
    if (msg === "UNAUTHORIZED") {
      return errorResponse(401, ERROR_CODES.UNAUTHORIZED, "Não autenticado.");
    }
    logGovernanceError("GET /api/governance/quality/inconsistencies", ERROR_CODES.INTERNAL_SERVER_ERROR, msg, err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro interno no servidor.");
  }
}
