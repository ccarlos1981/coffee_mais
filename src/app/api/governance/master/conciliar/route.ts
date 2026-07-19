import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { requireGovernanceAdmin } from "@/lib/governance/governance";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";
import { runConciliation } from "@/lib/governance/fase6/orchestrator";
import { getCachedConciliation, setCachedConciliation } from "@/lib/governance/fase6/cache";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const body = await req.json();
    const { matrixCode, periodStart, periodEnd, plannedAcaoId, forceRefresh } = body;

    // Validate body parameters
    if (!matrixCode) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O código da matriz é obrigatório.", "matrixCode");
    }
    if (!periodStart) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "A data de início do período é obrigatória.", "periodStart");
    }
    if (!periodEnd) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "A data de fim do período é obrigatória.", "periodEnd");
    }

    // 1. Attempt Cache Lookup if not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedConciliation(matrixCode, periodStart, periodEnd, plannedAcaoId);
      if (cached) {
        return successResponse(cached);
      }
    }

    // 2. Cache miss or forceRefresh: Run central orchestrator
    const result = await runConciliation(matrixCode, periodStart, periodEnd, user.id, plannedAcaoId);

    // 3. Store in Analítico Cache
    setCachedConciliation(matrixCode, periodStart, periodEnd, result, plannedAcaoId);

    return successResponse(result);

  } catch (err: any) {
    logGovernanceError("POST_CONCILIAR_API", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro ao processar conciliação.");
  }
}
