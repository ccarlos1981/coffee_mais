"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseCurrency(str: string | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/[R$\s\.]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseVolume(str: string | null): number | null {
  if (!str) return null;
  const cleaned = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ─── Fase 1: Criar / Editar Ação (Comercial) ───────────────────────────

export async function criarAcaoInvestimento(formData: FormData) {
  const supabase = await createClient();

  const rede = formData.get("rede") as string;
  const data_inicio = formData.get("data_inicio") as string;
  const data_fim = formData.get("data_fim") as string;
  const tipo_acao = formData.get("tipo_acao") as string;
  
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const tipo_pagamento = formData.get("tipo_pagamento") as string || "Abatimento";
  
  let skus_detalhes: any = [];
  if (abrangencia === "SKU") {
    const skus_str = formData.get("skus_detalhes") as string;
    if (skus_str) {
      try {
        skus_detalhes = JSON.parse(skus_str);
      } catch(e) {}
    }
  }

  const familia_produto = formData.get("familia_produto") as string || null;
  
  const preco_flat = parseCurrency(formData.get("preco_flat") as string);
  const preco_acao = parseCurrency(formData.get("preco_acao") as string);
  const valor_investimento = parseCurrency(formData.get("valor_investimento") as string);
  const expectativa_volume = parseVolume(formData.get("expectativa_volume") as string);

  if (!rede || !data_inicio || !data_fim || !tipo_acao) {
    throw new Error("Os campos Rede, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
  }

  if (abrangencia === "Família") {
    if (!familia_produto) {
      throw new Error("Para abrangência Família, Família de Produto é obrigatório.");
    }
  } else {
    if (!skus_detalhes || skus_detalhes.length === 0) {
      throw new Error("Para abrangência SKU, ao menos um SKU deve ser detalhado.");
    }
  }

  const { error } = await supabase.from("cm_acoes_investimento").insert([
    {
      rede,
      data_inicio,
      data_fim,
      tipo_acao,
      familia_produto,
      preco_flat,
      preco_acao,
      valor_investimento,
      expectativa_volume,
      abrangencia,
      tipo_pagamento,
      skus_detalhes,
      fase_atual: 1
    }
  ]);

  if (error) {
    console.error("Erro ao inserir ação de investimento:", error);
    throw new Error("Falha ao salvar investimento.");
  }

  revalidatePath("/investimento");
  return { success: true };
}

export async function atualizarAcaoInvestimento(id: string, formData: FormData) {
  const supabase = await createClient();

  const rede = formData.get("rede") as string;
  const data_inicio = formData.get("data_inicio") as string;
  const data_fim = formData.get("data_fim") as string;
  const tipo_acao = formData.get("tipo_acao") as string;
  
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const tipo_pagamento = formData.get("tipo_pagamento") as string || "Abatimento";
  
  let skus_detalhes: any = [];
  if (abrangencia === "SKU") {
    const skus_str = formData.get("skus_detalhes") as string;
    if (skus_str) {
      try {
        skus_detalhes = JSON.parse(skus_str);
      } catch(e) {}
    }
  }

  const familia_produto = formData.get("familia_produto") as string || null;
  
  const preco_flat = parseCurrency(formData.get("preco_flat") as string);
  const preco_acao = parseCurrency(formData.get("preco_acao") as string);
  const valor_investimento = parseCurrency(formData.get("valor_investimento") as string);
  const expectativa_volume = parseVolume(formData.get("expectativa_volume") as string);

  if (!rede || !data_inicio || !data_fim || !tipo_acao) {
    throw new Error("Os campos Rede, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
  }

  if (abrangencia === "Família") {
    if (!familia_produto) {
      throw new Error("Para abrangência Família, Família de Produto é obrigatório.");
    }
  } else {
    if (!skus_detalhes || skus_detalhes.length === 0) {
      throw new Error("Para abrangência SKU, ao menos um SKU deve ser detalhado.");
    }
  }

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      rede,
      data_inicio,
      data_fim,
      tipo_acao,
      familia_produto,
      preco_flat,
      preco_acao,
      valor_investimento,
      expectativa_volume,
      abrangencia,
      tipo_pagamento,
      skus_detalhes
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar ação de investimento:", error);
    throw new Error("Falha ao atualizar investimento.");
  }

  revalidatePath("/investimento");
  return { success: true };
}

// ─── Fase 2: Validação pelo Trade ───────────────────────────────────────

export async function atualizarChecklistTrade(id: string, checklist: {
  comunicacao: boolean;
  logistica: boolean;
  auditoria: boolean;
  garantia: boolean;
  conferencia: boolean;
}) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      checklist_comunicacao: checklist.comunicacao,
      checklist_logistica: checklist.logistica,
      checklist_auditoria: checklist.auditoria,
      checklist_garantia: checklist.garantia,
      checklist_conferencia: checklist.conferencia
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar checklist do Trade:", error);
    throw new Error("Falha ao salvar checklist.");
  }
}

export async function enviarParaTrade(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 2,
    })
    .eq("id", id)
    .eq("fase_atual", 1);

  if (error) {
    console.error("Erro ao enviar para o Trade:", error);
    throw new Error("Falha ao enviar para o Trade.");
  }

  revalidatePath("/investimento");
}

export async function validarTrade(id: string, checklist: {
  comunicacao: boolean;
  logistica: boolean;
  auditoria: boolean;
  garantia: boolean;
  conferencia: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 3,
      trade_validado_em: new Date().toISOString(),
      trade_validado_por: user?.email || "unknown",
      checklist_comunicacao: checklist.comunicacao,
      checklist_logistica: checklist.logistica,
      checklist_auditoria: checklist.auditoria,
      checklist_garantia: checklist.garantia,
      checklist_conferencia: checklist.conferencia
    })
    .eq("id", id)
    .eq("fase_atual", 2);

  if (error) {
    console.error("Erro ao validar pelo Trade:", error);
    throw new Error("Falha ao validar pelo Trade.");
  }

  revalidatePath("/investimento");
}

// ─── Fase 3: Apuração Comercial (Dossiê) ────────────────────────────────

export async function preencherApuracao(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const apuracao_numero_acordo = formData.get("apuracao_numero_acordo") as string;
  const apuracao_qtd_vendida = parseInt(formData.get("apuracao_qtd_vendida") as string) || null;
  const apuracao_valor_realizado = parseFloat((formData.get("apuracao_valor_realizado") as string)?.replace(',', '.') || '0') || null;
  const apuracao_boleto_id = formData.get("apuracao_boleto_id") as string || null;
  
  // Evidências
  const apuracao_evidencias_url = formData.get("apuracao_evidencias_url") as string || null;

  if (!apuracao_numero_acordo) {
    throw new Error("Número do Acordo é obrigatório.");
  }

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 4,
      apuracao_numero_acordo,
      apuracao_qtd_vendida,
      apuracao_valor_realizado,
      apuracao_boleto_id,
      apuracao_evidencias_url,
      apuracao_preenchida_em: new Date().toISOString(),
      apuracao_preenchida_por: user?.email || "unknown"
    })
    .eq("id", id)
    .eq("fase_atual", 3);

  if (error) {
    console.error("Erro ao preencher apuração:", error);
    throw new Error("Falha ao salvar apuração.");
  }

  // Update Boleto status to Abatido? Wait, maybe when we select it, it stays Aberto until the end?
  // Let's leave it as is for now, the connection is made.

  revalidatePath("/investimento");
}

// ─── Fase 4: Conferência pelo Trade ─────────────────────────────────────

export async function conferirTrade(id: string, aprovado: boolean, observacao?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const updateData: any = {
    trade_conferido_em: new Date().toISOString(),
    trade_conferido_por: user?.email || "unknown",
    trade_conferencia_aprovado: aprovado,
    trade_conferencia_observacao: observacao || null,
  };

  if (aprovado) {
    // Aprovado → avança para Fase 5 (Financeiro)
    updateData.fase_atual = 5;
  } else {
    // Reprovado → volta para Fase 3 (Gerente refaz apuração)
    updateData.fase_atual = 3;
    // Limpar dados de apuração para refazer
    updateData.apuracao_preenchida_em = null;
    updateData.apuracao_preenchida_por = null;
  }

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update(updateData)
    .eq("id", id)
    .eq("fase_atual", 4);

  if (error) {
    console.error("Erro ao conferir Trade:", error);
    throw new Error("Falha ao processar conferência.");
  }

  revalidatePath("/investimento");
}

// ─── Fase 5: Confirmação de Pagamento (Financeiro) ──────────────────────

export async function confirmarPagamento(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const financeiro_observacoes = formData.get("financeiro_observacoes") as string || null;
  
  // Comprovante é URL já salva no storage
  const financeiro_comprovante_url = formData.get("financeiro_comprovante_url") as string || null;

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 6,
      financeiro_pago_em: new Date().toISOString(),
      financeiro_pago_por: user?.email || "unknown",
      financeiro_comprovante_url,
      financeiro_observacoes,
    })
    .eq("id", id)
    .eq("fase_atual", 5);

  if (error) {
    console.error("Erro ao confirmar pagamento:", error);
    throw new Error("Falha ao confirmar pagamento.");
  }

  revalidatePath("/investimento");
}
