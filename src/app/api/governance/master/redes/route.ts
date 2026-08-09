import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/governance/auth";
import { requireGovernanceAdmin } from "@/lib/governance/governance";
import { successResponse, errorResponse } from "@/lib/governance/response";
import { logGovernanceError } from "@/lib/governance/logging";
import { ERROR_CODES } from "@/lib/governance/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { CommercialDomainService } from "@/lib/domain";

export async function GET(req: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedUser();
    
    const { data, error } = await supabase
      .from("cm_redes_matrizes")
      .select("*")
      .order("nome", { ascending: true });

    if (error) throw error;
    return successResponse(data);

  } catch (err: any) {
    logGovernanceError("GET_MASTER_REDES", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao carregar redes comerciais.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    
    // Auth & role check
    await requireGovernanceAdmin(supabase, user.id);

    const body = await req.json();
    const { codigo, nome, canal, manager_id, manager } = body;

    if (!codigo || !nome || !manager) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Código, Nome e Gerente são obrigatórios.");
    }

    const adminClient = createAdminClient();

    // 1. Insert into official cm_redes_matrizes
    const { data: rede, error: insertErr } = await adminClient
      .from("cm_redes_matrizes")
      .insert({
        codigo,
        nome,
        canal: (await CommercialDomainService.resolveChannel(canal)).dbValue,
        manager_id: manager_id || null,
        manager
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 2. Sync to legacy network_matrix (Legacy Compatibility Policy)
    const { error: syncErr } = await adminClient
      .from("network_matrix")
      .insert({
        network: nome,
        network_uf: nome,
        manager,
        manager_id: manager_id || CommercialDomainService.resolveManager(manager).managerId || "9999",
        region: CommercialDomainService.isStandaloneChannelManager(manager) ? manager : "Sudeste"
      });

    if (syncErr) {
      logGovernanceError("LEGACY_SYNC_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, syncErr.message, syncErr);
    }

    // 3. Write to audit log
    const { error: auditErr } = await adminClient
      .from("cm_audit_ownership_log")
      .insert({
        request_id: null,
        action_type: "CREATE_MATRIX",
        old_value: null,
        new_value: JSON.stringify({ codigo, nome, canal, manager }),
        justificativa: "Criação de Rede/Matriz via Cadastro Mestre Comercial",
        executed_by: user.id
      });

    if (auditErr) {
      logGovernanceError("AUDIT_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, auditErr.message, auditErr);
    }

    return successResponse(rede);

  } catch (err: any) {
    logGovernanceError("POST_MASTER_REDES", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao criar rede comercial.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    await requireGovernanceAdmin(supabase, user.id);

    const body = await req.json();
    const { codigo, nome, canal, manager_id, manager } = body;

    if (!codigo) {
      return errorResponse(400, ERROR_CODES.BAD_REQUEST, "Código da rede é obrigatório.");
    }

    const adminClient = createAdminClient();

    // Load current values for audit backup
    const { data: oldVal, error: fetchErr } = await adminClient
      .from("cm_redes_matrizes")
      .select("*")
      .eq("codigo", codigo)
      .single();

    if (fetchErr || !oldVal) {
      return errorResponse(404, ERROR_CODES.NOT_FOUND, "Rede não encontrada.");
    }

    // 1. Update official cm_redes_matrizes
    const { data: rede, error: updateErr } = await adminClient
      .from("cm_redes_matrizes")
      .update({
        nome: nome || oldVal.nome,
        canal: canal || oldVal.canal,
        manager_id: manager_id !== undefined ? manager_id : oldVal.manager_id,
        manager: manager || oldVal.manager
      })
      .eq("codigo", codigo)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 2. Sync to legacy network_matrix (Legacy Compatibility Policy)
    if (nome || manager) {
      const { error: syncErr } = await adminClient
        .from("network_matrix")
        .update({
          network: nome || oldVal.nome,
          manager: manager || oldVal.manager,
          manager_id: manager_id || oldVal.manager_id || "9999"
        })
        .eq("network", oldVal.nome);

      if (syncErr) {
        logGovernanceError("LEGACY_SYNC_UPDATE_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, syncErr.message, syncErr);
      }
    }

    // 3. Write to audit log
    const { error: auditErr } = await adminClient
      .from("cm_audit_ownership_log")
      .insert({
        request_id: null,
        action_type: "CHANGE_MANAGER",
        old_value: JSON.stringify(oldVal),
        new_value: JSON.stringify(rede),
        justificativa: "Atualização de Rede/Matriz via Cadastro Mestre Comercial",
        executed_by: user.id
      });

    if (auditErr) {
      logGovernanceError("AUDIT_LOG_WARNING", ERROR_CODES.INTERNAL_SERVER_ERROR, auditErr.message, auditErr);
    }

    return successResponse(rede);

  } catch (err: any) {
    logGovernanceError("PATCH_MASTER_REDES", ERROR_CODES.INTERNAL_SERVER_ERROR, err.message || "Erro", err);
    return errorResponse(500, ERROR_CODES.INTERNAL_SERVER_ERROR, "Erro ao editar rede comercial.");
  }
}
