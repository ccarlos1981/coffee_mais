import { NextRequest } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { requireGovernanceAdmin } from "@/lib/governance/governance";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireAuthenticatedUser();
    const body = await req.json();

    const { next_status, notes } = body;

    if (!next_status) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O próximo status da transição é obrigatório.", "next_status");
    }

    // Load request details
    const { data: request, error: fetchErr } = await supabase
      .from("cm_ownership_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !request) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, "Solicitação não encontrada.");
    }

    // Role verification based on target status
    if (next_status === "APROVADO" || next_status === "REJEITADO") {
      // Must be governance admin
      try {
        await requireGovernanceAdmin(supabase, user.id);
      } catch (err: any) {
        return errorResponse(403, ERROR_CODES.FORBIDDEN, "Apenas administradores de governança podem aprovar ou rejeitar solicitações.");
      }
    } else if (next_status === "CANCELADO" || next_status === "PENDENTE_APROVACAO") {
      // Must be the request owner/creator
      if (request.created_by !== user.id) {
        return errorResponse(403, ERROR_CODES.FORBIDDEN, "Apenas o autor da solicitação pode enviá-la para aprovação ou cancelá-la.");
      }
    } else {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, `Status de destino '${next_status}' inválido.`);
    }

    // Call transition database function
    const { error: transitionErr } = await supabase.rpc("transition_ownership_request", {
      p_request_id: id,
      p_next_status: next_status,
      p_notes: notes || "Transição via API",
      p_actor_id: user.id
    });

    if (transitionErr) {
      throw transitionErr;
    }

    // If transitioned successfully, refresh MV and generate quality snapshot
    // This guarantees immediate dashboard consistency for Phase 3!
    const { error: refreshErr } = await supabase.rpc("refresh_mv_inconsistencias");

    if (refreshErr) {
      logGovernanceError("REFRESH_MV_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, refreshErr.message, refreshErr);
    }

    const { error: snapshotErr } = await supabase.rpc("take_cadastros_quality_snapshot", {
      p_source: "manual"
    });

    if (snapshotErr) {
      logGovernanceError("SNAPSHOT_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, snapshotErr.message, snapshotErr);
    }

    return successResponse({ id, status: next_status });

  } catch (err: any) {
    logGovernanceError("POST_TRANSITION", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro de transição", err);
    return errorResponse(
      err.status || 500,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      err.message || "Erro ao processar transição de estados."
    );
  }
}
