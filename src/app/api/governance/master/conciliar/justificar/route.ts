import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";
import { clearConciliationCache } from "@/lib/governance/fase6/cache";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();

    const body = await req.json();
    const { acaoId, justificativa, executionId } = body;

    if (!acaoId) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O ID da ação é obrigatório.", "acaoId");
    }
    if (!justificativa || justificativa.trim() === "") {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "A justificativa é obrigatória.", "justificativa");
    }

    // Insert justification into the official platform audit logs to maintain full traceability
    const { error } = await supabase
      .from("cm_audit_ownership_log")
      .insert({
        action_type: "UPDATE_SETTING", // Reuses allowed ENUM constraint from Baseline v1.1.0
        old_value: {},
        new_value: {
          type: "JUSTIFY_AUDIT_ALERT",
          acaoId,
          executionId: executionId || "N/A"
        },
        justificativa: justificativa.trim(),
        executed_by: user.id
      });

    if (error) {
      throw error;
    }

    // Evict cached conciliation reports to reflect the new justification immediately
    clearConciliationCache();

    return successResponse({ success: true, acaoId });

  } catch (err: any) {
    logGovernanceError("POST_JUSTIFY_API", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro ao salvar justificativa.");
  }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const acaoId = searchParams.get("acaoId");

    if (!acaoId) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O ID da ação é obrigatório.", "acaoId");
    }

    // Retrieve previous justifications for the action
    const { data: logs, error } = await supabase
      .from("cm_audit_ownership_log")
      .select("id, justificativa, executed_at, executed_by, new_value, cm_user_profiles(name, email)")
      .eq("action_type", "UPDATE_SETTING")
      .contains("new_value", { type: "JUSTIFY_AUDIT_ALERT", acaoId })
      .order("executed_at", { ascending: false });

    if (error) {
      throw error;
    }

    // Parse executionId from new_value
    const parsedLogs = (logs || []).map((log: any) => ({
      id: log.id,
      justificativa: log.justificativa,
      executed_at: log.executed_at,
      executed_by: log.executed_by,
      executionId: log.new_value?.executionId || "N/A",
      cm_user_profiles: log.cm_user_profiles
    }));

    return successResponse(parsedLogs);

  } catch (err: any) {
    logGovernanceError("GET_JUSTIFY_API", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro ao carregar justificativas.");
  }
}
