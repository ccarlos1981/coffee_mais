"use server";

import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface Boleto {
  id: string;
  rede: string;
  numero_boleto: string;
  valor_total: number;
  vencimento: string;
  status: string;
  created_at: string;
  nro_nota?: string | null;
  parceiro_codigo?: string | null;
  valor_liquido?: number | null;
  tipo_titulo?: string | null;
  prazo?: string | null;
}

export async function validarAcessoBoletos(exigirEscrita = false): Promise<{ allowed: boolean; role?: string; userEmail?: string; error?: string }> {
  try {
    const supabaseServer = await createClient();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();

    if (authError || !user) {
      return { allowed: false, error: "Usuário não autenticado." };
    }

    const { data: profile } = await supabaseServer
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";
    const roleLower = role.toLowerCase();

    const isAdminOrFinanceiro = ["admin", "admin master", "financeiro", "ceo", "trade"].includes(roleLower);
    const isGerente = roleLower.includes("gerente") || roleLower.includes("manager");

    if (exigirEscrita) {
      if (isAdminOrFinanceiro) {
        return { allowed: true, role, userEmail: user.email };
      }
      return { allowed: false, role, error: "Acesso negado: Perfil GERENTE possui acesso apenas para leitura." };
    }

    if (isAdminOrFinanceiro || isGerente) {
      return { allowed: true, role, userEmail: user.email };
    }

    return { allowed: false, role, error: "Acesso negado." };
  } catch (err: any) {
    console.error("Erro na verificação de acesso de boletos:", err);
    return { allowed: false, error: err?.message || "Erro de autorização." };
  }
}

export async function validarPermissaoExportacaoBoletos(): Promise<{ allowed: boolean; error?: string }> {
  const authRes = await validarAcessoBoletos(false);
  if (!authRes.allowed) {
    return { allowed: false, error: authRes.error || "Acesso negado para exportação." };
  }
  return { allowed: true };
}

export async function listarBoletos(): Promise<Boleto[]> {
  const authRes = await validarAcessoBoletos(false);
  if (!authRes.allowed) {
    console.error("Tentativa não autorizada em listarBoletos:", authRes.error);
    return [];
  }

  const { data, error } = await supabase
    .from("cm_boletos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar boletos:", error);
    return [];
  }
  return data as Boleto[];
}

export async function importarBoletos(boletos: Omit<Boleto, "id" | "created_at" | "status">[]) {
  try {
    const authRes = await validarAcessoBoletos(true);
    if (!authRes.allowed) {
      return { success: false, error: authRes.error || "Acesso negado: Operação de escrita não permitida para o seu perfil." };
    }

    const boletosToInsert = boletos.map((b) => ({
      rede: b.rede.toUpperCase(),
      numero_boleto: b.numero_boleto,
      valor_total: b.valor_total,
      vencimento: b.vencimento,
      status: "Aberto",
      nro_nota: b.nro_nota || b.numero_boleto,
      parceiro_codigo: b.parceiro_codigo || "",
      valor_liquido: b.valor_liquido || b.valor_total,
      tipo_titulo: b.tipo_titulo || "BOLETO",
    }));

    const { error } = await supabase.from("cm_boletos").insert(boletosToInsert);

    if (error) throw error;
    
    revalidatePath("/financeiro/boletos");
    return { success: true };
  } catch (err: any) {
    console.error("Erro ao importar boletos:", err);
    return { success: false, error: err.message };
  }
}

export async function listarBoletosAbertosPorRede(rede: string): Promise<Boleto[]> {
  const { data, error } = await supabase
    .from("cm_boletos")
    .select("*")
    .eq("rede", rede.toUpperCase())
    .eq("status", "Aberto")
    .order("vencimento", { ascending: true });

  if (error) {
    console.error("Erro ao listar boletos por rede:", error);
    return [];
  }
  return data as Boleto[];
}

export async function listarRedesDisponiveis(): Promise<string[]> {
  const { data, error } = await supabase
    .from("view_redes_disponiveis")
    .select("rede");

  if (error) {
    console.error("Erro ao listar redes da view view_redes_disponiveis:", error);
    // Fallback in case the view is not created yet (failsafe)
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("base_atendimento")
      .select("rede")
      .not("rede", "is", null)
      .limit(1000);

    if (fallbackError) {
      console.error("Erro ao listar redes via fallback:", fallbackError);
      return [];
    }
    const redesSet = new Set(fallbackData.map((r: any) => r.rede));
    return Array.from(redesSet).sort() as string[];
  }

  return (data || []).map((r: any) => r.rede);
}

export async function atualizarBoleto(id: string, updates: Partial<Boleto>) {
  try {
    const authRes = await validarAcessoBoletos(true);
    if (!authRes.allowed) {
      return { success: false, error: authRes.error || "Acesso negado: Operação de edição não permitida para o seu perfil." };
    }

    const { error } = await supabase
      .from("cm_boletos")
      .update(updates)
      .eq("id", id);

    if (error) throw error;
    
    revalidatePath("/financeiro/boletos");
    return { success: true };
  } catch (err: any) {
    console.error("Erro ao atualizar boleto:", err);
    return { success: false, error: err.message };
  }
}

