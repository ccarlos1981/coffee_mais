import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { requireGovernanceAdmin } from "@/lib/governance/governance";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    
    const { data, error } = await supabase
      .from("cm_base_atendimento_regional")
      .select(`
        *,
        cm_redes_matrizes:cliente_matriz_id (
          nome
        ),
        cm_user_profiles:gerente_responsavel_id (
          name
        )
      `)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return successResponse(data);

  } catch (err: any) {
    logGovernanceError("GET_REGIONAL", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao carregar regras de regionalização.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const body = await req.json();
    const { cliente_matriz_id, estado, gerente_responsavel_id } = body;

    // Validate parameters
    if (!cliente_matriz_id) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "A Matriz é obrigatória.", "cliente_matriz_id");
    }
    if (!estado || estado.length !== 2) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O Estado (UF) é inválido.", "estado");
    }
    if (!gerente_responsavel_id) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O Gerente é obrigatório.", "gerente_responsavel_id");
    }

    const adminClient = createAdminClient();

    // 1. Verify if matrix exists
    const { data: matrix, error: matErr } = await adminClient
      .from("cm_redes_matrizes")
      .select("nome")
      .eq("codigo", cliente_matriz_id)
      .maybeSingle();

    if (matErr || !matrix) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, `A Matriz '${cliente_matriz_id}' não existe.`);
    }

    // 2. Verify if manager exists and is approved
    const { data: profile, error: profErr } = await adminClient
      .from("cm_user_profiles")
      .select("name")
      .eq("id", gerente_responsavel_id)
      .eq("approved", true)
      .maybeSingle();

    if (profErr || !profile) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Gerente não localizado ou inativo no sistema.");
    }

    // 3. Prevent duplicate mapping (matrix + state)
    const { data: duplicate } = await adminClient
      .from("cm_base_atendimento_regional")
      .select("id")
      .eq("cliente_matriz_id", cliente_matriz_id)
      .eq("estado", estado)
      .eq("ativo", true)
      .maybeSingle();

    if (duplicate) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, `Já existe uma regionalização ativa para a matriz '${cliente_matriz_id}' no estado de '${estado}'.`);
    }

    // 4. Create regional rule (atomic transaction)
    const { data: rule, error: createErr } = await adminClient
      .from("cm_base_atendimento_regional")
      .insert({
        cliente_matriz_id,
        estado,
        gerente_responsavel_id,
        regional: "Regional",
        ativo: true
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // 5. Log change to audit trail
    const { error: auditErr } = await adminClient
      .from("cm_audit_ownership_log")
      .insert({
        request_id: null,
        action_type: "CHANGE_MANAGER",
        old_value: null,
        new_value: JSON.stringify(rule),
        justificativa: `Adicionada regionalização da matriz ${cliente_matriz_id} (${estado}) liderada por ${profile.name}`,
        executed_by: user.id
      });

    if (auditErr) {
      logGovernanceError("AUDIT_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, auditErr.message, auditErr);
    }

    // 6. Impact hook: refresh inconsistencies and snapshots
    const { error: refreshErr } = await adminClient.rpc("refresh_mv_inconsistencias");
    if (refreshErr) {
      logGovernanceError("REFRESH_MV_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, refreshErr.message, refreshErr);
    }

    const { error: snapshotErr } = await adminClient.rpc("take_cadastros_quality_snapshot", {
      p_source: "manual"
    });
    if (snapshotErr) {
      logGovernanceError("SNAPSHOT_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, snapshotErr.message, snapshotErr);
    }

    return successResponse(rule);

  } catch (err: any) {
    logGovernanceError("POST_REGIONAL", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao criar regionalização.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O ID do registro é obrigatório.");
    }

    const adminClient = createAdminClient();

    // 1. Fetch current rule details
    const { data: rule, error: fetchErr } = await adminClient
      .from("cm_base_atendimento_regional")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !rule) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, "Registro de regionalização não localizado.");
    }

    // 2. Perform deletion (set active = false or hard delete. Let's do set active = false)
    const { data: deletedRule, error: deleteErr } = await adminClient
      .from("cm_base_atendimento_regional")
      .update({
        ativo: false,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (deleteErr) throw deleteErr;

    // 3. Log change to audit trail
    const { error: auditErr } = await adminClient
      .from("cm_audit_ownership_log")
      .insert({
        request_id: null,
        action_type: "CHANGE_MANAGER",
        old_value: JSON.stringify(rule),
        new_value: JSON.stringify(deletedRule),
        justificativa: `Inativada regionalização da matriz ${rule.cliente_matriz_id} (${rule.estado})`,
        executed_by: user.id
      });

    if (auditErr) {
      logGovernanceError("AUDIT_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, auditErr.message, auditErr);
    }

    // 4. Impact hook: refresh inconsistencies and snapshots
    const { error: refreshErr } = await adminClient.rpc("refresh_mv_inconsistencias");
    if (refreshErr) {
      logGovernanceError("REFRESH_MV_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, refreshErr.message, refreshErr);
    }

    const { error: snapshotErr } = await adminClient.rpc("take_cadastros_quality_snapshot", {
      p_source: "manual"
    });
    if (snapshotErr) {
      logGovernanceError("SNAPSHOT_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, snapshotErr.message, snapshotErr);
    }

    return successResponse({ id, status: "INATIVO" });

  } catch (err: any) {
    logGovernanceError("DELETE_REGIONAL", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao remover regionalização.");
  }
}
