"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ActionResult, ActionErrorCode, successResult, errorResult, handleActionError } from "@/lib/types/action-result";
import { requireAuth, requireApprovedProfile } from "@/lib/supabase/auth-helpers";

// Helper type
export interface RegionalBaseItem {
  id: string;
  cliente_matriz_id: string;
  estado: string;
  regional: string;
  gerente_responsavel_id: string | null;
  supervisor_responsavel_id: string | null;
  distribuidor_responsavel_id: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  matriz_nome?: string;
  gerente_nome?: string;
  supervisor_nome?: string;
  distribuidor_nome?: string;
}

/**
 * Busca todas as bases regionais cadastradas.
 */
export async function obterBasesRegionais(): Promise<ActionResult<RegionalBaseItem[]>> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("cm_base_atendimento_regional")
      .select(`
        *,
        cm_redes_matrizes!inner(nome),
        gerente:cm_user_profiles!cm_base_atendimento_regional_gerente_responsavel_id_fkey(name),
        supervisor:cm_user_profiles!cm_base_atendimento_regional_supervisor_responsavel_id_fkey(name),
        distribuidor:cm_user_profiles!cm_base_atendimento_regional_distribuidor_responsavel_id_fkey(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao buscar as bases regionais: " + error.message);
    }

    const mapped = (data || []).map((item: any) => ({
      id: item.id,
      cliente_matriz_id: item.cliente_matriz_id,
      estado: item.estado,
      regional: item.regional,
      gerente_responsavel_id: item.gerente_responsavel_id,
      supervisor_responsavel_id: item.supervisor_responsavel_id,
      distribuidor_responsavel_id: item.distribuidor_responsavel_id,
      ativo: item.ativo,
      created_at: item.created_at,
      updated_at: item.updated_at,
      matriz_nome: item.cm_redes_matrizes?.nome || "Sem Nome Matriz",
      gerente_nome: item.gerente?.name || null,
      supervisor_nome: item.supervisor?.name || null,
      distribuidor_nome: item.distribuidor?.name || null
    }));

    return successResult(mapped);
  } catch (error) {
    return handleActionError(error, {
      module: "ConfigFinanceiro",
      action: "obterBasesRegionais"
    });
  }
}

/**
 * Busca a lista completa de Matrizes e Perfis de Usuários para popular os dropdowns no cadastro.
 */
export async function obterDadosAuxiliares(): Promise<ActionResult<{
  matrizes: Array<{ codigo: string; nome: string }>;
  usuarios: Array<{ id: string; name: string; role: string }>;
}>> {
  const supabase = await createClient();
  try {
    const { data: matrizesData, error: mError } = await supabase
      .from("cm_redes_matrizes")
      .select("codigo, nome")
      .order("nome", { ascending: true });

    if (mError) {
      return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao carregar matrizes: " + mError.message);
    }

    const { data: usuariosData, error: uError } = await supabase
      .from("cm_user_profiles")
      .select("id, name, role")
      .order("name", { ascending: true });

    if (uError) {
      return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao carregar usuários: " + uError.message);
    }

    return successResult({
      matrizes: matrizesData || [],
      usuarios: usuariosData || []
    });
  } catch (error) {
    return handleActionError(error, {
      module: "ConfigFinanceiro",
      action: "obterDadosAuxiliares"
    });
  }
}

/**
 * Cadastra ou edita um mapeamento regional.
 */
export async function salvarBaseRegional(payload: {
  id?: string;
  cliente_matriz_id: string;
  estado: string;
  regional: string;
  gerente_responsavel_id: string | null;
  supervisor_responsavel_id?: string | null;
  distribuidor_responsavel_id?: string | null;
  ativo: boolean;
}): Promise<ActionResult<any>> {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    const roleLower = profile.role?.toLowerCase();
    if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "financeiro") {
      return errorResult(ActionErrorCode.UNAUTHORIZED, "Acesso não autorizado. Apenas administradores, CEO ou financeiro podem realizar esta alteração.");
    }
    const supabase = await createClient();
    if (!payload.cliente_matriz_id || !payload.estado || !payload.regional) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Matriz, Estado e Regional são obrigatórios.");
    }

    const cleanPayload = {
      cliente_matriz_id: payload.cliente_matriz_id,
      estado: payload.estado.toUpperCase().trim(),
      regional: payload.regional.trim(),
      gerente_responsavel_id: payload.gerente_responsavel_id || null,
      supervisor_responsavel_id: payload.supervisor_responsavel_id || null,
      distribuidor_responsavel_id: payload.distribuidor_responsavel_id || null,
      ativo: payload.ativo,
      updated_at: new Date().toISOString()
    };

    if (payload.id) {
      // Editar
      const { data, error } = await supabase
        .from("cm_base_atendimento_regional")
        .update(cleanPayload)
        .eq("id", payload.id)
        .select();

      if (error) {
        if (error.code === "23505") {
          return errorResult(ActionErrorCode.BUSINESS_RULE_VIOLATION, "Já existe uma base regional cadastrada para esta Matriz neste Estado.");
        }
        return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao atualizar base regional: " + error.message);
      }

      revalidatePath("/config-financeiro/multiestado");
      return successResult(data?.[0]);
    } else {
      // Criar novo
      const { data, error } = await supabase
        .from("cm_base_atendimento_regional")
        .insert([cleanPayload])
        .select();

      if (error) {
        if (error.code === "23505") {
          return errorResult(ActionErrorCode.BUSINESS_RULE_VIOLATION, "Já existe uma base regional cadastrada para esta Matriz neste Estado.");
        }
        return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao criar base regional: " + error.message);
      }

      revalidatePath("/config-financeiro/multiestado");
      return successResult(data?.[0]);
    }
  } catch (error) {
    return handleActionError(error, {
      module: "ConfigFinanceiro",
      action: "salvarBaseRegional"
    });
  }
}

/**
 * Remove um mapeamento regional.
 */
export async function excluirBaseRegional(id: string): Promise<ActionResult<{ success: boolean }>> {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    const roleLower = profile.role?.toLowerCase();
    if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "financeiro") {
      return errorResult(ActionErrorCode.UNAUTHORIZED, "Acesso não autorizado. Apenas administradores, CEO ou financeiro podem realizar esta alteração.");
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("cm_base_atendimento_regional")
      .delete()
      .eq("id", id);

    if (error) {
      return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao excluir base regional: " + error.message);
    }

    revalidatePath("/config-financeiro/multiestado");
    return successResult({ success: true });
  } catch (error) {
    return handleActionError(error, {
      module: "ConfigFinanceiro",
      action: "excluirBaseRegional"
    });
  }
}

/**
 * Recalcula manualmente o responsável por todos os clientes afetados.
 */
export async function recalcularClientesResponsaveis(): Promise<ActionResult<{ rowsAffected: number }>> {
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    const roleLower = profile.role?.toLowerCase();
    if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "financeiro") {
      return errorResult(ActionErrorCode.UNAUTHORIZED, "Acesso não autorizado. Apenas administradores, CEO ou financeiro podem realizar esta alteração.");
    }
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("recalcular_responsaveis_clientes");

    if (error) {
      return errorResult(ActionErrorCode.INTERNAL_ERROR, "Erro ao recalcular responsáveis: " + error.message);
    }

    revalidatePath("/config-financeiro/clientes");
    return successResult({ rowsAffected: Number(data) || 0 });
  } catch (error) {
    return handleActionError(error, {
      module: "ConfigFinanceiro",
      action: "recalcularClientesResponsaveis"
    });
  }
}
