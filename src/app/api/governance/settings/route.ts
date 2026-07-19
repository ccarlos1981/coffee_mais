import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { requireGovernanceAdmin } from "@/lib/governance/governance";
import { parsePatchSettingBody } from "@/lib/governance/validation";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    const { data: settings, error } = await supabase
      .from("cm_governance_settings")
      .select("key, value, description, updated_at")
      .order("key", { ascending: true });

    if (error) {
      throw error;
    }

    return successResponse(settings);
  } catch (err: any) {
    const msg = err.message || "";
    if (msg === "UNAUTHORIZED") {
      return errorResponse(401, ERROR_CODES.UNAUTHORIZED, "Não autenticado.");
    }
    logGovernanceError("GET /api/governance/settings", ERROR_CODES.INTERNAL_SERVER_ERROR, msg, err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro interno no servidor.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const { key, value } = await parsePatchSettingBody(req);

    const { data: updated, error } = await supabase
      .from("cm_governance_settings")
      .update({
        value,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq("key", key)
      .select("key, value, description, updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!updated) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, `Chave de configuração '${key}' não encontrada.`);
    }

    return successResponse(updated);
  } catch (err: any) {
    const msg = err.message || "";
    if (msg === "UNAUTHORIZED") {
      return errorResponse(401, ERROR_CODES.UNAUTHORIZED, "Não autenticado.");
    }
    if (msg === "FORBIDDEN") {
      return errorResponse(403, ERROR_CODES.FORBIDDEN, "Acesso não autorizado para este perfil.");
    }
    if (msg === "INVALID_BODY" || msg === "INVALID_KEY" || msg === "MISSING_VALUE") {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Parâmetros do corpo da requisição inválidos.", msg);
    }
    logGovernanceError("PATCH /api/governance/settings", ERROR_CODES.INTERNAL_SERVER_ERROR, msg, err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro interno no servidor.");
  }
}
