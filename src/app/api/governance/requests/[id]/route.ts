import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireAuthenticatedUser();
    const body = await req.json();

    const {
      uf_proposta,
      codigo_matriz_proposto,
      responsavel_proposto,
      justificativa
    } = body;

    // Load request details
    const { data: request, error: fetchErr } = await supabase
      .from("cm_ownership_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !request) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, "Solicitação não encontrada.");
    }

    // Direct status checking (governance check)
    if (request.status !== "RASCUNHO") {
      return errorResponse(
        400,
        ERROR_CODES.BAD_REQUEST,
        "Apenas solicitações em estado RASCUNHO podem ser modificadas."
      );
    }

    // Authorization check
    if (request.created_by !== user.id) {
      return errorResponse(
        403,
        ERROR_CODES.FORBIDDEN,
        "Você não tem permissão para editar esta solicitação."
      );
    }

    // Perform updates
    const { data: updatedRequest, error: updateErr } = await supabase
      .from("cm_ownership_requests")
      .update({
        uf_proposta,
        codigo_matriz_proposto,
        responsavel_proposto,
        justificativa: justificativa || request.justificativa,
        versao: request.versao + 1,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr || !updatedRequest) {
      throw updateErr || new Error("Erro ao atualizar solicitação.");
    }

    // Write audit log
    const { error: logErr } = await supabase
      .from("cm_audit_ownership_log")
      .insert({
        request_id: id,
        action_type: "CREATE_REQUEST", // Treating modification as version log
        old_value: JSON.stringify({
          uf_proposta: request.uf_proposta,
          codigo_matriz_proposto: request.codigo_matriz_proposto,
          responsavel_proposto: request.responsavel_proposto
        }),
        new_value: JSON.stringify({
          uf_proposta,
          codigo_matriz_proposto,
          responsavel_proposto
        }),
        justificativa: justificativa || "Atualização de rascunho",
        executed_by: user.id
      });

    if (logErr) {
      logGovernanceError("PATCH_REQUEST_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, logErr.message, logErr);
    }

    return successResponse(updatedRequest);

  } catch (err: any) {
    logGovernanceError("PATCH_REQUEST", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro de edição", err);
    return errorResponse(
      err.status || 500,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      err.message || "Erro ao editar solicitação."
    );
  }
}
