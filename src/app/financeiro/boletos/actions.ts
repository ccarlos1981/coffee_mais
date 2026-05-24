"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface Boleto {
  id: string;
  rede: string;
  numero_boleto: string;
  valor_total: number;
  vencimento: string;
  status: string;
  created_at: string;
}

export async function listarBoletos(): Promise<Boleto[]> {
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
    const boletosToInsert = boletos.map((b) => ({
      rede: b.rede.toUpperCase(),
      numero_boleto: b.numero_boleto,
      valor_total: b.valor_total,
      vencimento: b.vencimento,
      status: "Aberto",
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
  let allRedesData: any[] = [];
  let hasMore = true;
  let page = 0;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from("base_atendimento")
      .select("rede")
      .not("rede", "is", null)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (error) {
      console.error("Erro ao listar redes:", error);
      return [];
    }

    if (data && data.length > 0) {
      allRedesData = [...allRedesData, ...data];
      page++;
      if (data.length < 1000) hasMore = false;
    } else {
      hasMore = false;
    }
  }
  
  const redesSet = new Set(allRedesData.map((r: any) => r.rede));
  return Array.from(redesSet).sort() as string[];
}

export async function atualizarBoleto(id: string, updates: Partial<Boleto>) {
  try {
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
