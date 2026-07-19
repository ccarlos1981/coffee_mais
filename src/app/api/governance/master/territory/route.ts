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
      .from("manager_uf_mapping")
      .select("*")
      .order("uf", { ascending: true });

    if (error) throw error;
    return successResponse(data);

  } catch (err: any) {
    logGovernanceError("GET_TERRITORY", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao carregar mapeamento territorial.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const body = await req.json();
    const { uf, manager } = body;

    // Direct parameter validation
    if (!uf || uf.length !== 2) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "A UF informada é inválida (deve conter 2 caracteres).", "uf");
    }
    if (!manager) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "O gerente selecionado é obrigatório.", "manager");
    }

    const adminClient = createAdminClient();

    // 1. Validate if manager exists and is approved
    const { data: profile, error: profErr } = await adminClient
      .from("cm_user_profiles")
      .select("name")
      .eq("name", manager)
      .eq("approved", true)
      .maybeSingle();

    if (profErr || !profile) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, `O gerente '${manager}' não foi localizado ou não está aprovado no sistema.`);
    }

    // 2. Fetch current value for audit logging
    const { data: oldVal, error: fetchErr } = await adminClient
      .from("manager_uf_mapping")
      .select("*")
      .eq("uf", uf)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    // 3. Update the territorial mapping (atomic operation)
    const { data: updatedRecord, error: updateErr } = await adminClient
      .from("manager_uf_mapping")
      .upsert({
        uf,
        manager,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 4. Log change to cm_audit_ownership_log
    const { error: auditErr } = await adminClient
      .from("cm_audit_ownership_log")
      .insert({
        request_id: null,
        action_type: "CHANGE_UF",
        old_value: oldVal ? JSON.stringify(oldVal) : null,
        new_value: JSON.stringify(updatedRecord),
        justificativa: `Alteração de gerente responsável default da UF ${uf}`,
        executed_by: user.id
      });

    if (auditErr) {
      logGovernanceError("AUDIT_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, auditErr.message, auditErr);
    }

    // 5. Operational impact: refresh inconsistencies view and generate new snapshot
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

    return successResponse(updatedRecord);

  } catch (err: any) {
    logGovernanceError("PATCH_TERRITORY", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao atualizar mapeamento territorial.");
  }
}
