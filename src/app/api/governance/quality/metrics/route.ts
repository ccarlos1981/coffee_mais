import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { parseMetricsQueryParams } from "@/lib/governance/validation";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { limit } = parseMetricsQueryParams(req);

    // 1. Obter o último snapshot como métrica atual
    const { data: latestSnapshot, error: latestError } = await supabase
      .from("cm_cadastros_qualidade_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    // 2. Obter a série histórica de snapshots
    const { data: history, error: historyError } = await supabase
      .from("cm_cadastros_qualidade_snapshots")
      .select("snapshot_date, iqc_score, cobertura_score, baseline_version, audit_rules_version")
      .order("snapshot_date", { ascending: true })
      .limit(limit);

    if (historyError) {
      throw historyError;
    }

    return successResponse({
      current_metrics: latestSnapshot || null,
      history: history || []
    });
  } catch (err: any) {
    const msg = err.message || "";
    if (msg === "UNAUTHORIZED") {
      return errorResponse(401, ERROR_CODES.UNAUTHORIZED, "Não autenticado.");
    }
    logGovernanceError("GET /api/governance/quality/metrics", ERROR_CODES.INTERNAL_SERVER_ERROR, msg, err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro interno no servidor.");
  }
}
