"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import nodemailer from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function avaliarAlertasAcaoInvestimento(
  supabase: any,
  abrangencia: string,
  familias_detalhes: any[],
  skus_detalhes: any[],
  rede: string,
  codigo_matriz: string
): Promise<any[]> {
  const alertas: any[] = [];

  // Construct items with their source details
  const items: Array<{ label: string; source: 'familia' | 'sku'; details: any }> = [];
  if (familias_detalhes && familias_detalhes.length > 0) {
    familias_detalhes.forEach(f => {
      items.push({ label: f.familia_nome, source: 'familia', details: f });
    });
  }
  if (skus_detalhes && skus_detalhes.length > 0) {
    skus_detalhes.forEach(s => {
      items.push({ label: s.sku, source: 'sku', details: s });
    });
  }

  // 1. Desconto acima de 40%
  items.forEach((item) => {
    const flat = Number(item.details.preco_flat) || 0;
    const acao = Number(item.details.preco_acao) || 0;
    if (flat > 0) {
      const desc = (flat - acao) / flat;
      if (desc > 0.40) {
        alertas.push({
          tipo: "DESCONTO_ALTO",
          mensagem: `Desconto de ${(desc * 100).toFixed(1)}% em ${item.label} acima do limite preventivo de 40%.`,
          item: item.label,
          valor: desc,
          source: item.source
        });
      }
    }
  });

  // 2. Fetch past approved actions for history checks
  const { data: pastActions } = await supabase
    .from("cm_acoes_investimento")
    .select("abrangencia, familias_detalhes, skus_detalhes, real_volume, roi, valor_investimento, real_margem, expectativa_volume")
    .eq("codigo_matriz", codigo_matriz)
    .gte("fase_atual", 5);

  // Check Volume and ROI per item
  for (const item of items) {
    const vol = Number(item.details.expectativa_volume) || 0;

    let matchedVolumes: number[] = [];
    let matchedROIs: number[] = [];

    // Fallback 1: Rede + SKU/Família
    if (pastActions) {
      pastActions.forEach((pa: any) => {
        const targetDetails = item.source === 'familia' ? pa.familias_detalhes : pa.skus_detalhes;
        if (Array.isArray(targetDetails)) {
          targetDetails.forEach((d: any) => {
            const detailLabel = item.source === 'familia' ? d.familia_nome : d.sku;
            if (detailLabel === item.label) {
              const pastVol = Number(pa.real_volume || d.expectativa_volume) || 0;
              if (pastVol > 0) matchedVolumes.push(pastVol);
              const pastRoi = Number(pa.roi || (Number(d.real_margem || 0) / Number(d.investimento || 1))) || 0;
              if (pastRoi > 0) matchedROIs.push(pastRoi);
            }
          });
        }
      });
    }

    // Fallback 2: Rede General
    if (matchedVolumes.length === 0 && pastActions) {
      pastActions.forEach((pa: any) => {
        const pastVol = Number(pa.real_volume || pa.expectativa_volume) || 0;
        if (pastVol > 0) matchedVolumes.push(pastVol);
        const pastRoi = Number(pa.roi) || 0;
        if (pastRoi > 0) matchedROIs.push(pastRoi);
      });
    }

    // Fallback 3: Category General (Overall past actions for same SKU/Family across all networks)
    if (matchedVolumes.length === 0) {
      const { data: catActions } = await supabase
        .from("cm_acoes_investimento")
        .select("abrangencia, familias_detalhes, skus_detalhes, real_volume, roi, expectativa_volume")
        .gte("fase_atual", 5)
        .limit(50);
      if (catActions) {
        catActions.forEach((pa: any) => {
          const targetDetails = item.source === 'familia' ? pa.familias_detalhes : pa.skus_detalhes;
          if (Array.isArray(targetDetails)) {
            targetDetails.forEach((d: any) => {
              const detailLabel = item.source === 'familia' ? d.familia_nome : d.sku;
              if (detailLabel === item.label) {
                const pastVol = Number(pa.real_volume || d.expectativa_volume) || 0;
                if (pastVol > 0) matchedVolumes.push(pastVol);
                const pastRoi = Number(pa.roi) || 0;
                if (pastRoi > 0) matchedROIs.push(pastRoi);
              }
            });
          }
        });
      }
    }

    // Fallback 4: Sem alerta if matchedVolumes is empty

    // Analyze volume
    if (matchedVolumes.length > 0) {
      const avgVol = matchedVolumes.reduce((a, b) => a + b, 0) / matchedVolumes.length;
      if (vol > avgVol * 2) {
        alertas.push({
          tipo: "VOLUME_ALTO",
          mensagem: `Volume de ${vol.toLocaleString('pt-BR')} para ${item.label} está muito acima da média histórica de ${Math.round(avgVol).toLocaleString('pt-BR')}.`,
          item: item.label,
          valor: vol,
          media_historica: avgVol,
          source: item.source
        });
      }
    }

    // Analyze ROI
    if (matchedROIs.length > 0) {
      const avgRoi = matchedROIs.reduce((a, b) => a + b, 0) / matchedROIs.length;
      if (avgRoi < 1.0) {
        alertas.push({
          tipo: "ROI_HISTORICO_RUIM",
          mensagem: `ROI histórico para ${item.label} nesta rede/geral é crítico (${avgRoi.toFixed(2)} < 1.0).`,
          item: item.label,
          valor: avgRoi,
          source: item.source
        });
      }
    }
  }

  return alertas;
}

// ─── Fase 1: Criar / Editar Ação (Comercial) ───────────────────────────

export async function criarAcaoInvestimento(formData: FormData) {
  const supabase = await createClient();

  const rede = formData.get("rede") as string;
  const codigo_matriz = formData.get("codigo_matriz") as string;
  const data_inicio = formData.get("data_inicio") as string;
  const data_fim = formData.get("data_fim") as string;
  const tipo_acao = formData.get("tipo_acao") as string;
  const mes_referencia = formData.get("mes_referencia") as string;
  const date_mode = (formData.get("date_mode") as string) || "single";
  
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const tipo_pagamento = formData.get("tipo_pagamento") as string || "Transf. Bancária";
  
  // Parse familias_detalhes (multi-family JSONB)
  let familias_detalhes: any = [];
  const fam_str = formData.get("familias_detalhes") as string;
  if (fam_str) {
    try {
      familias_detalhes = JSON.parse(fam_str);
    } catch(e) {}
  }

  // Parse skus_detalhes (multi-SKU JSONB)
  let skus_detalhes: any = [];
  const skus_str = formData.get("skus_detalhes") as string;
  if (skus_str) {
    try {
      skus_detalhes = JSON.parse(skus_str);
    } catch(e) {}
  }

  // Backward compat: familia_produto as comma-separated string
  let familia_produto = formData.get("familia_produto") as string || "";
  if (!familia_produto) {
    const famNames = (familias_detalhes || []).map((f: any) => f.familia_nome);
    if (famNames.length > 0) {
      familia_produto = famNames.join(", ");
    } else {
      familia_produto = "Múltiplos SKUs";
    }
  }

  if (!rede || (date_mode === "single" && (!data_inicio || !data_fim)) || !tipo_acao || !mes_referencia) {
    throw new Error("Os campos Rede, Mês de Referência, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
  }

  if ((!familias_detalhes || familias_detalhes.length === 0) && (!skus_detalhes || skus_detalhes.length === 0)) {
    throw new Error("Ao menos uma família ou um SKU deve ser selecionado.");
  }

  let calculated_data_inicio = data_inicio;
  let calculated_data_fim = data_fim;

  if (date_mode === "multiple") {
    const dates: string[] = [];
    if (familias_detalhes && familias_detalhes.length > 0) {
      for (const f of familias_detalhes) {
        if (!f.start_date || !f.end_date) {
          throw new Error(`A família ${f.familia_nome} precisa ter Data Início e Data Fim definidas.`);
        }
        dates.push(f.start_date, f.end_date);
      }
    }
    if (skus_detalhes && skus_detalhes.length > 0) {
      for (const s of skus_detalhes) {
        if (!s.start_date || !s.end_date) {
          throw new Error(`O SKU ${s.sku} precisa ter Data Início e Data Fim definidas.`);
        }
        dates.push(s.start_date, s.end_date);
      }
    }
    if (dates.length > 0) {
      const sorted = dates.map(d => new Date(d + "T00:00:00")).sort((a, b) => a.getTime() - b.getTime());
      calculated_data_inicio = sorted[0].toISOString().slice(0, 10);
      calculated_data_fim = sorted[sorted.length - 1].toISOString().slice(0, 10);
    } else {
      throw new Error("Ao menos um item com período definido deve ser selecionado no modo Múltiplas Datas.");
    }
  } else {
    // Replicate global dates to details JSONB
    if (familias_detalhes && familias_detalhes.length > 0) {
      familias_detalhes = familias_detalhes.map((f: any) => ({
        ...f,
        start_date: data_inicio,
        end_date: data_fim
      }));
    }
    if (skus_detalhes && skus_detalhes.length > 0) {
      skus_detalhes = skus_detalhes.map((s: any) => ({
        ...s,
        start_date: data_inicio,
        end_date: data_fim
      }));
    }
  }

  // Financial validations for families
  if (familias_detalhes && familias_detalhes.length > 0) {
    for (const f of familias_detalhes) {
      if (f.preco_acao && f.preco_flat && f.preco_acao > f.preco_flat) {
        throw new Error(`Família ${f.familia_nome}: Preço Ação (${f.preco_acao}) não pode ser maior que Preço Flat (${f.preco_flat}).`);
      }
      if (f.investimento_manual) {
        const { data: { user } } = await supabase.auth.getUser();
        f.investimento_override_by = user?.id || null;
      }
    }
  }

  // Financial validations for SKUs
  if (skus_detalhes && skus_detalhes.length > 0) {
    for (const s of skus_detalhes) {
      if (s.preco_acao && s.preco_flat && s.preco_acao > s.preco_flat) {
        throw new Error(`SKU ${s.sku}: Preço Ação (${s.preco_acao}) não pode ser maior que Preço Flat (${s.preco_flat}).`);
      }
      if (s.investimento_manual) {
        const { data: { user } } = await supabase.auth.getUser();
        s.investimento_override_by = user?.id || null;
      }
    }
  }

  // Calculate weighted averages across both Families and SKUs for database columns
  let total_volume = 0;
  let total_investimento = 0;
  let total_flat_weighted = 0;
  let total_acao_weighted = 0;

  if (familias_detalhes && familias_detalhes.length > 0) {
    for (const f of familias_detalhes) {
      const vol = Number(f.expectativa_volume) || 0;
      const inv = Number(f.investimento) || 0;
      const flat = Number(f.preco_flat) || 0;
      const acao = Number(f.preco_acao) || 0;
      total_volume += vol;
      total_investimento += inv * vol;
      total_flat_weighted += flat * vol;
      total_acao_weighted += acao * vol;
    }
  }

  if (skus_detalhes && skus_detalhes.length > 0) {
    for (const s of skus_detalhes) {
      const vol = Number(s.expectativa_volume) || 0;
      const inv = Number(s.investimento) || 0;
      const flat = Number(s.preco_flat) || 0;
      const acao = Number(s.preco_acao) || 0;
      total_volume += vol;
      total_investimento += inv * vol;
      total_flat_weighted += flat * vol;
      total_acao_weighted += acao * vol;
    }
  }

  const valor_investimento = total_volume > 0 ? (total_investimento / total_volume) : 0;
  const preco_flat = total_volume > 0 ? (total_flat_weighted / total_volume) : 0;
  const preco_acao = total_volume > 0 ? (total_acao_weighted / total_volume) : 0;
  const expectativa_volume = total_volume;

  const is_planejamento = formData.get("is_planejamento") === "true";

  // Evaluate alerts
  const alertas_preventivos = await avaliarAlertasAcaoInvestimento(
    supabase,
    abrangencia,
    familias_detalhes,
    skus_detalhes,
    rede,
    codigo_matriz
  );

  const { error } = await supabase.from("cm_acoes_investimento").insert([
    {
      rede,
      codigo_matriz: codigo_matriz || null,
      data_inicio: calculated_data_inicio,
      data_fim: calculated_data_fim,
      date_mode,
      tipo_acao,
      familia_produto,
      familias_detalhes,
      preco_flat,
      preco_acao,
      valor_investimento,
      expectativa_volume,
      abrangencia,
      tipo_pagamento,
      skus_detalhes,
      mes_referencia,
      fase_atual: 1,
      is_planejamento,
      alertas_preventivos
    }
  ]);

  if (error) {
    console.error("Erro ao inserir ação de investimento:", error);
    throw new Error("Falha ao salvar investimento.");
  }

  revalidatePath("/investimento");
  revalidatePath("/investimento/planejamento");
  return { success: true, is_planejamento };
}

export async function atualizarAcaoInvestimento(id: string, formData: FormData) {
  const supabase = await createClient();

  const rede = formData.get("rede") as string;
  const codigo_matriz = formData.get("codigo_matriz") as string;
  const data_inicio = formData.get("data_inicio") as string;
  const data_fim = formData.get("data_fim") as string;
  const tipo_acao = formData.get("tipo_acao") as string;
  const mes_referencia = formData.get("mes_referencia") as string;
  const date_mode = (formData.get("date_mode") as string) || "single";
  
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const tipo_pagamento = formData.get("tipo_pagamento") as string || "Transf. Bancária";
  
  // Parse familias_detalhes (multi-family JSONB)
  let familias_detalhes: any = [];
  const fam_str = formData.get("familias_detalhes") as string;
  if (fam_str) {
    try {
      familias_detalhes = JSON.parse(fam_str);
    } catch(e) {}
  }

  // Parse skus_detalhes (multi-SKU JSONB)
  let skus_detalhes: any = [];
  const skus_str = formData.get("skus_detalhes") as string;
  if (skus_str) {
    try {
      skus_detalhes = JSON.parse(skus_str);
    } catch(e) {}
  }

  let familia_produto = formData.get("familia_produto") as string || "";
  if (!familia_produto) {
    const famNames = (familias_detalhes || []).map((f: any) => f.familia_nome);
    if (famNames.length > 0) {
      familia_produto = famNames.join(", ");
    } else {
      familia_produto = "Múltiplos SKUs";
    }
  }

  if (!rede || (date_mode === "single" && (!data_inicio || !data_fim)) || !tipo_acao || !mes_referencia) {
    throw new Error("Os campos Rede, Mês de Referência, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
  }

  if ((!familias_detalhes || familias_detalhes.length === 0) && (!skus_detalhes || skus_detalhes.length === 0)) {
    throw new Error("Ao menos uma família ou um SKU deve ser selecionado.");
  }

  let calculated_data_inicio = data_inicio;
  let calculated_data_fim = data_fim;

  if (date_mode === "multiple") {
    const dates: string[] = [];
    if (familias_detalhes && familias_detalhes.length > 0) {
      for (const f of familias_detalhes) {
        if (!f.start_date || !f.end_date) {
          throw new Error("Cada família selecionada no modo Múltiplas Datas precisa ter Data Início e Data Fim definidas.");
        }
        dates.push(f.start_date, f.end_date);
      }
    }
    if (skus_detalhes && skus_detalhes.length > 0) {
      for (const s of skus_detalhes) {
        if (!s.start_date || !s.end_date) {
          throw new Error("Cada SKU selecionado no modo Múltiplas Datas precisa ter Data Início e Data Fim definidas.");
        }
        dates.push(s.start_date, s.end_date);
      }
    }
    if (dates.length > 0) {
      const sorted = dates.map(d => new Date(d + "T00:00:00")).sort((a, b) => a.getTime() - b.getTime());
      calculated_data_inicio = sorted[0].toISOString().slice(0, 10);
      calculated_data_fim = sorted[sorted.length - 1].toISOString().slice(0, 10);
    } else {
      throw new Error("Ao menos um item com período definido deve ser selecionado no modo Múltiplas Datas.");
    }
  } else {
    // Replicate global dates to details JSONB
    if (familias_detalhes && familias_detalhes.length > 0) {
      familias_detalhes = familias_detalhes.map((f: any) => ({
        ...f,
        start_date: data_inicio,
        end_date: data_fim
      }));
    }
    if (skus_detalhes && skus_detalhes.length > 0) {
      skus_detalhes = skus_detalhes.map((s: any) => ({
        ...s,
        start_date: data_inicio,
        end_date: data_fim
      }));
    }
  }

  // Financial validations for families
  if (familias_detalhes && familias_detalhes.length > 0) {
    for (const f of familias_detalhes) {
      if (f.preco_acao && f.preco_flat && f.preco_acao > f.preco_flat) {
        throw new Error(`Família ${f.familia_nome}: Preço Ação (${f.preco_acao}) não pode ser maior que Preço Flat (${f.preco_flat}).`);
      }
      if (f.investimento_manual) {
        const { data: { user } } = await supabase.auth.getUser();
        f.investimento_override_by = user?.id || null;
      }
    }
  }

  // Financial validations for SKUs
  if (skus_detalhes && skus_detalhes.length > 0) {
    for (const s of skus_detalhes) {
      if (s.preco_acao && s.preco_flat && s.preco_acao > s.preco_flat) {
        throw new Error(`SKU ${s.sku}: Preço Ação (${s.preco_acao}) não pode ser maior que Preço Flat (${s.preco_flat}).`);
      }
      if (s.investimento_manual) {
        const { data: { user } } = await supabase.auth.getUser();
        s.investimento_override_by = user?.id || null;
      }
    }
  }

  const is_planejamento = formData.get("is_planejamento") === "true";

  // Check lock by status (fase_atual >= 5)
  const { data: currentAction } = await supabase
    .from("cm_acoes_investimento")
    .select("fase_atual")
    .eq("id", id)
    .single();

  if (currentAction && (currentAction.fase_atual || 1) >= 5) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autorizado.");
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const roleLower = profile?.role?.toLowerCase();
    if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "diretor") {
      throw new Error("Esta ação está aprovada e bloqueada para edição. Somente diretores, CEO ou Admin podem reabrir ou alterar.");
    }
  }

  // Calculate weighted averages across both Families and SKUs for database columns
  let total_volume = 0;
  let total_investimento = 0;
  let total_flat_weighted = 0;
  let total_acao_weighted = 0;

  if (familias_detalhes && familias_detalhes.length > 0) {
    for (const f of familias_detalhes) {
      const vol = Number(f.expectativa_volume) || 0;
      const inv = Number(f.investimento) || 0;
      const flat = Number(f.preco_flat) || 0;
      const acao = Number(f.preco_acao) || 0;
      total_volume += vol;
      total_investimento += inv * vol;
      total_flat_weighted += flat * vol;
      total_acao_weighted += acao * vol;
    }
  }

  if (skus_detalhes && skus_detalhes.length > 0) {
    for (const s of skus_detalhes) {
      const vol = Number(s.expectativa_volume) || 0;
      const inv = Number(s.investimento) || 0;
      const flat = Number(s.preco_flat) || 0;
      const acao = Number(s.preco_acao) || 0;
      total_volume += vol;
      total_investimento += inv * vol;
      total_flat_weighted += flat * vol;
      total_acao_weighted += acao * vol;
    }
  }

  const valor_investimento = total_volume > 0 ? (total_investimento / total_volume) : 0;
  const preco_flat = total_volume > 0 ? (total_flat_weighted / total_volume) : 0;
  const preco_acao = total_volume > 0 ? (total_acao_weighted / total_volume) : 0;
  const expectativa_volume = total_volume;

  // Evaluate alerts
  const alertas_preventivos = await avaliarAlertasAcaoInvestimento(
    supabase,
    abrangencia,
    familias_detalhes,
    skus_detalhes,
    rede,
    codigo_matriz
  );

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      rede,
      codigo_matriz: codigo_matriz || null,
      data_inicio: calculated_data_inicio,
      data_fim: calculated_data_fim,
      date_mode,
      tipo_acao,
      familia_produto,
      familias_detalhes,
      preco_flat,
      preco_acao,
      valor_investimento,
      expectativa_volume,
      abrangencia,
      tipo_pagamento,
      skus_detalhes,
      mes_referencia,
      is_planejamento,
      alertas_preventivos
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar ação de investimento:", error);
    throw new Error("Falha ao atualizar investimento.");
  }

  revalidatePath("/investimento");
  revalidatePath("/investimento/planejamento");
  return { success: true, is_planejamento };
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

  // Enviar e-mail de notificação para o Trade
  try {
    const { data: actionView } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("*")
      .eq("id", id)
      .single();

    if (actionView && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const adminClient = createAdminClient();

      // Buscar e-mail do gerente regional
      let managerEmail = "";
      if (actionView.gerente_responsavel) {
        const { data: profiles } = await adminClient
          .from("cm_user_profiles")
          .select("id")
          .eq("name", actionView.gerente_responsavel);

        if (profiles && profiles.length > 0) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(profiles[0].id);
          if (authUser?.user?.email) managerEmail = authUser.user.email;
        }
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
      });

      const recipientsSet = new Set<string>();
      recipientsSet.add("trade@coffeemais.com");
      if (managerEmail && managerEmail.includes("@")) recipientsSet.add(managerEmail);
      const recipients = Array.from(recipientsSet).join(", ");

      const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return "R$ 0,00";
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      };

      const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "-";
        try { const d = new Date(dateStr); d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); return d.toLocaleDateString('pt-BR'); } catch { return dateStr || "-"; }
      };

      const formatMesReferencia = (mes: string | null | undefined) => {
        if (!mes) return "-";
        const parts = mes.split('-');
        if (parts.length === 2) {
          const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
          const idx = parseInt(parts[1]) - 1;
          if (idx >= 0 && idx < 12) return `${meses[idx]}/${parts[0]}`;
        }
        return mes;
      };

      const getValorTotal = (r: any) => {
        if (r.abrangencia === "SKU" && r.skus_detalhes) {
          return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
        }
        return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
      };

      const subject = `📋 NOVA AÇÃO PARA VALIDAÇÃO — Fase 2 — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 24px 30px;">
            <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">📋 Nova Ação Enviada para Validação</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #bfdbfe;">A ação abaixo foi enviada pelo Comercial e aguarda validação do Trade.</p>
          </div>

          <div style="padding: 25px 30px;">
            <!-- Fase Indicator -->
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
              <table style="width: 100%; font-size: 12px; color: #6b7280;">
                <tr>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">1</div>
                    <div style="margin-top: 2px; color: #10b981; font-weight: 600;">Criação ✓</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">2</div>
                    <div style="margin-top: 2px; color: #2563eb; font-weight: 700;">Trade ◀ ATUAL</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #d1d5db; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">3</div>
                    <div style="margin-top: 2px;">Apuração</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #d1d5db; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">4</div>
                    <div style="margin-top: 2px;">Conferência</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #d1d5db; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">5</div>
                    <div style="margin-top: 2px;">Pagamento</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Action: what just happened -->
            <div style="background: #dbeafe; border-left: 4px solid #2563eb; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px; color: #1e40af;">
              <strong>Ação realizada:</strong> O Comercial finalizou o cadastro desta ação e a enviou para validação do Trade.
            </div>

            <!-- Dados da Ação -->
            <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Detalhes da Ação</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563; width: 40%;">Código:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">#${actionView.codigo || actionView.id}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Rede:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${actionView.rede}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Tipo de Ação:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.tipo_acao || "-"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Abrangência:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.abrangencia || "Família"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Família / SKU:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.abrangencia === "SKU" ? "Múltiplos SKUs" : (actionView.familias_detalhes && actionView.familias_detalhes.length > 0 ? actionView.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : (actionView.familia_produto || "-"))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Mês Referência:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatMesReferencia(actionView.mes_referencia)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Período:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatDate(actionView.data_inicio)} a ${formatDate(actionView.data_fim)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Valor Estimado:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #b45309;">${formatCurrency(getValorTotal(actionView))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Gerente Regional:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
              </tr>
            </table>

            <!-- Rodapé -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
            <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              Este é um e-mail automático do sistema <strong>Coffee++ Mais</strong>.<br/>
              Acesse a plataforma para revisar e validar esta ação.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
        to: recipients,
        subject,
        html: htmlBody,
      });

      console.log(`[Email Fase 1→2] Notificação enviada para: ${recipients}`);
    }
  } catch (mailErr) {
    console.error("Erro ao enviar e-mail de envio para Trade:", mailErr);
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

  // Enviar e-mail de notificação para Trade + Financeiro
  try {
    const { data: actionView } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("*")
      .eq("id", id)
      .single();

    if (actionView && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const adminClient = createAdminClient();

      let managerEmail = "";
      if (actionView.gerente_responsavel) {
        const { data: profiles } = await adminClient
          .from("cm_user_profiles")
          .select("id")
          .eq("name", actionView.gerente_responsavel);

        if (profiles && profiles.length > 0) {
          const { data: authUser } = await adminClient.auth.admin.getUserById(profiles[0].id);
          if (authUser?.user?.email) managerEmail = authUser.user.email;
        }
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: false }
      });

      const recipientsSet = new Set<string>();
      recipientsSet.add("trade@coffeemais.com");
      recipientsSet.add("financeiro@coffeemais.com");
      if (managerEmail && managerEmail.includes("@")) recipientsSet.add(managerEmail);
      const recipients = Array.from(recipientsSet).join(", ");

      const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return "R$ 0,00";
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
      };

      const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "-";
        try { const d = new Date(dateStr); d.setMinutes(d.getMinutes() + d.getTimezoneOffset()); return d.toLocaleDateString('pt-BR'); } catch { return dateStr || "-"; }
      };

      const formatMesReferencia = (mes: string | null | undefined) => {
        if (!mes) return "-";
        const parts = mes.split('-');
        if (parts.length === 2) {
          const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
          const idx = parseInt(parts[1]) - 1;
          if (idx >= 0 && idx < 12) return `${meses[idx]}/${parts[0]}`;
        }
        return mes;
      };

      const getValorTotal = (r: any) => {
        if (r.abrangencia === "SKU" && r.skus_detalhes) {
          return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
        }
        return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
      };

      const checkIcon = (val: boolean) => val ? "✅" : "⬜";

      const subject = `✅ AÇÃO VALIDADA PELO TRADE — Fase 3 — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 24px 30px;">
            <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">✅ Ação Validada pelo Trade</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #a7f3d0;">O Trade validou esta ação. Ela agora aguarda apuração comercial (dossiê).</p>
          </div>

          <div style="padding: 25px 30px;">
            <!-- Fase Indicator -->
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
              <table style="width: 100%; font-size: 12px; color: #6b7280;">
                <tr>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">1</div>
                    <div style="margin-top: 2px; color: #10b981; font-weight: 600;">Criação ✓</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #10b981; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">2</div>
                    <div style="margin-top: 2px; color: #10b981; font-weight: 600;">Trade ✓</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">3</div>
                    <div style="margin-top: 2px; color: #2563eb; font-weight: 700;">Apuração ◀ ATUAL</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #d1d5db; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">4</div>
                    <div style="margin-top: 2px;">Conferência</div>
                  </td>
                  <td style="text-align: center; padding: 4px;">
                    <div style="background: #d1d5db; color: white; border-radius: 50%; width: 24px; height: 24px; line-height: 24px; text-align: center; margin: 0 auto; font-weight: bold; font-size: 11px;">5</div>
                    <div style="margin-top: 2px;">Pagamento</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Action: what just happened -->
            <div style="background: #d1fae5; border-left: 4px solid #059669; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px; color: #065f46;">
              <strong>Ação realizada:</strong> O Trade validou esta ação. Validado por <strong>${user?.email || "—"}</strong> em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. A ação segue agora para apuração comercial (dossiê).
            </div>

            <!-- Checklist do Trade -->
            <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Checklist do Trade</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
              <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 6px 8px;">${checkIcon(checklist.comunicacao)} Comunicação</td></tr>
              <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 6px 8px;">${checkIcon(checklist.logistica)} Logística</td></tr>
              <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 6px 8px;">${checkIcon(checklist.auditoria)} Auditoria</td></tr>
              <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 6px 8px;">${checkIcon(checklist.garantia)} Garantia</td></tr>
              <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 6px 8px;">${checkIcon(checklist.conferencia)} Conferência</td></tr>
            </table>

            <!-- Dados da Ação -->
            <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Detalhes da Ação</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563; width: 40%;">Código:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">#${actionView.codigo || actionView.id}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Rede:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${actionView.rede}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Tipo de Ação:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.tipo_acao || "-"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Abrangência:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.abrangencia || "Família"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Família / SKU:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.abrangencia === "SKU" ? "Múltiplos SKUs" : (actionView.familias_detalhes && actionView.familias_detalhes.length > 0 ? actionView.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : (actionView.familia_produto || "-"))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Mês Referência:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatMesReferencia(actionView.mes_referencia)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Período:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatDate(actionView.data_inicio)} a ${formatDate(actionView.data_fim)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Valor Estimado:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #b45309;">${formatCurrency(getValorTotal(actionView))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Gerente Regional:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
              </tr>
            </table>

            <!-- Rodapé -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
            <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              Este é um e-mail automático do sistema <strong>Coffee++ Mais</strong>.<br/>
              A ação aguarda agora a apuração comercial (dossiê) pelo Gerente Regional.
            </p>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
        to: recipients,
        subject,
        html: htmlBody,
      });

      console.log(`[Email Fase 2→3] Notificação enviada para: ${recipients}`);
    }
  } catch (mailErr) {
    console.error("Erro ao enviar e-mail de validação do Trade:", mailErr);
  }

  revalidatePath("/investimento");
}

// ─── Auxiliar para Envio de E-mail de Apuração Comercial ───────────────

async function enviarEmailNotificacaoApuracao(
  acaoId: string, 
  managerEmail: string, 
  apuracaoBoletoId: string | null
) {
  try {
    const supabase = await createClient();

    // 1. Buscar detalhes da ação
    const { data: acao, error: acaoError } = await supabase
      .from("cm_acoes_investimento")
      .select("*")
      .eq("id", acaoId)
      .single();

    if (acaoError || !acao) {
      console.error("Erro ao buscar detalhes da ação para envio de e-mail:", acaoError);
      return;
    }

    // 2. Buscar todos os boletos vinculados
    const { data: vinculosData } = await supabase
      .from("cm_acoes_boletos_vinculo")
      .select("valor_associado, cm_boletos:boleto_id(id, numero_boleto, rede, valor_total, vencimento, status)")
      .eq("acao_id", acaoId);

    // 3. Obter URL do documento se houver
    let documentoSignedUrl = "";
    if (acao.documento_url) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("comprovantes_investimento")
        .createSignedUrl(acao.documento_url, 60 * 60 * 24 * 30); // 30 dias

      if (!signedError && signedData?.signedUrl) {
        documentoSignedUrl = signedData.signedUrl;
      }
    }

    // 4. Configurar Nodemailer
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("Variáveis SMTP_USER ou SMTP_PASS não estão configuradas no .env.local.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // 5. Destinatários
    const recipientsSet = new Set<string>();
    recipientsSet.add("financeiro@coffeemais.com");
    recipientsSet.add("joao.monteiro@coffeemais.com");
    recipientsSet.add("cristiano.santos@coffeemais.com");
    if (managerEmail && managerEmail.includes("@")) {
      recipientsSet.add(managerEmail);
    }
    const recipients = Array.from(recipientsSet).join(", ");

    // 6. Formatações auxiliares
    const formatCurrency = (val: number | null | undefined) => {
      if (val === null || val === undefined) return "R$ 0,00";
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        return d.toLocaleDateString('pt-BR');
      } catch (e) {
        return dateStr;
      }
    };

    const formatDateTime = (dateStr: string | null | undefined) => {
      if (!dateStr) return "-";
      try {
        return new Date(dateStr).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      } catch (e) {
        return dateStr;
      }
    };

    const formatMesReferencia = (mes: string | null | undefined) => {
      if (!mes) return "-";
      const parts = mes.split('-');
      if (parts.length === 2) {
        const [ano, numMes] = parts;
        const meses = [
          "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
        ];
        const idx = parseInt(numMes) - 1;
        if (idx >= 0 && idx < 12) {
          return `${meses[idx]}/${ano}`;
        }
      }
      return mes;
    };

    const getValorTotal = (r: any) => {
      if (r.abrangencia === "SKU" && r.skus_detalhes) {
        return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
      }
      return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
    };

    const valorProjetadoTotal = getValorTotal(acao);

    // 7. Renderizar Detalhes dos SKUs ou Família
    let detalhesInvestimentoHtml = "";
    if (acao.abrangencia === "SKU" && acao.skus_detalhes && Array.isArray(acao.skus_detalhes)) {
      detalhesInvestimentoHtml = `
        <h4 style="margin: 15px 0 5px 0; color: #b45309; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Detalhes dos SKUs</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 15px;">
          <thead>
            <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
              <th style="padding: 6px 8px; font-weight: bold; color: #374151;">SKU</th>
              <th style="padding: 6px 8px; font-weight: bold; color: #374151; text-align: right;">Flat</th>
              <th style="padding: 6px 8px; font-weight: bold; color: #374151; text-align: right;">Ação</th>
              <th style="padding: 6px 8px; font-weight: bold; color: #374151; text-align: right;">Inv. Unitário</th>
              <th style="padding: 6px 8px; font-weight: bold; color: #374151; text-align: center;">Vol. Esp.</th>
              <th style="padding: 6px 8px; font-weight: bold; color: #374151; text-align: right;">Total Est.</th>
            </tr>
          </thead>
          <tbody>
            ${acao.skus_detalhes.map((s: any) => `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${s.sku}</td>
                <td style="padding: 6px 8px; text-align: right; color: #4b5563;">${formatCurrency(s.preco_flat)}</td>
                <td style="padding: 6px 8px; text-align: right; color: #4b5563;">${formatCurrency(s.preco_acao)}</td>
                <td style="padding: 6px 8px; text-align: right; color: #b45309; font-weight: 500;">${formatCurrency(s.investimento)}</td>
                <td style="padding: 6px 8px; text-align: center; color: #4b5563;">${s.expectativa_volume || '-'}</td>
                <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #111827;">${formatCurrency((Number(s.investimento) || 0) * (Number(s.expectativa_volume) || 0))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    } else {
      detalhesInvestimentoHtml = `
        <h4 style="margin: 15px 0 5px 0; color: #b45309; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Detalhes do Investimento (Família)</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 15px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 6px 8px; color: #4b5563; width: 40%;">Família de Produto:</td>
            <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${acao.familias_detalhes && acao.familias_detalhes.length > 0 ? acao.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : (acao.familia_produto || "-")}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 6px 8px; color: #4b5563;">Preço Flat:</td>
            <td style="padding: 6px 8px; color: #111827;">${formatCurrency(acao.preco_flat)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 6px 8px; color: #4b5563;">Preço da Ação:</td>
            <td style="padding: 6px 8px; color: #111827;">${formatCurrency(acao.preco_acao)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 6px 8px; color: #4b5563;">Expectativa de Volume:</td>
            <td style="padding: 6px 8px; color: #111827;">${acao.expectativa_volume || "-"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 6px 8px; color: #4b5563;">Investimento Unitário:</td>
            <td style="padding: 6px 8px; font-weight: bold; color: #b45309;">${formatCurrency(acao.valor_investimento)}</td>
          </tr>
        </table>
      `;
    }

    // 8. Alerta ou detalhes dos boletos
    let boletoHtml = "";
    if (vinculosData && vinculosData.length > 0) {
      boletoHtml = `
        <div style="background-color: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #6b21a8; margin: 0 0 8px 0; font-size: 15px;">
            💜 Boletos Vinculados (${vinculosData.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid #e9d5ff; font-size: 11px; text-transform: uppercase; color: #581c87;">
                <th style="padding: 6px 0;">Número</th>
                <th style="padding: 6px 0;">Rede</th>
                <th style="padding: 6px 0; text-align: right;">Total do Boleto</th>
                <th style="padding: 6px 0; text-align: right;">Valor Associado</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      vinculosData.forEach((v: any) => {
        const b = v.cm_boletos;
        if (b) {
          boletoHtml += `
            <tr style="border-bottom: 1px solid #f3e8ff;">
              <td style="padding: 6px 0; color: #111827; font-weight: bold;">Nº ${b.numero_boleto}</td>
              <td style="padding: 6px 0; color: #4b5563;">${b.rede}</td>
              <td style="padding: 6px 0; color: #4b5563; text-align: right;">${formatCurrency(Number(b.valor_total))}</td>
              <td style="padding: 6px 0; color: #6b21a8; font-weight: bold; text-align: right;">${formatCurrency(Number(v.valor_associado))}</td>
            </tr>
          `;
        }
      });
      
      boletoHtml += `
            </tbody>
          </table>
        </div>
      `;
    } else {
      // Fallback a boleto individual (se houver mas não na tabela de vínculos, por compatibilidade)
      let fallbackBoleto = null;
      if (apuracaoBoletoId) {
        const { data: boletoData } = await supabase
          .from("cm_boletos")
          .select("*")
          .eq("id", apuracaoBoletoId)
          .single();
        if (boletoData) {
          fallbackBoleto = boletoData;
        }
      }

      if (fallbackBoleto) {
        const bVencimento = new Date(fallbackBoleto.vencimento);
        bVencimento.setMinutes(bVencimento.getMinutes() + bVencimento.getTimezoneOffset());
        const boletoVencimentoStr = bVencimento.toLocaleDateString('pt-BR');

        boletoHtml = `
          <div style="background-color: #f3e8ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h3 style="color: #6b21a8; margin: 0 0 8px 0; font-size: 15px;">
              💜 Boleto Vinculado
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
              <tr>
                <td style="padding: 3px 0; color: #581c87; font-weight: 500; width: 30%;">Número do Boleto:</td>
                <td style="padding: 3px 0; color: #111827; font-weight: bold;">${fallbackBoleto.numero_boleto}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #581c87; font-weight: 500;">Rede do Boleto:</td>
                <td style="padding: 3px 0; color: #111827;">${fallbackBoleto.rede}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #581c87; font-weight: 500;">Valor do Boleto:</td>
                <td style="padding: 3px 0; color: #111827; font-weight: bold;">${formatCurrency(Number(fallbackBoleto.valor_total))}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #581c87; font-weight: 500;">Vencimento:</td>
                <td style="padding: 3px 0; color: #111827;">${boletoVencimentoStr}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0; color: #581c87; font-weight: 500;">Status do Boleto:</td>
                <td style="padding: 3px 0; color: #111827; font-weight: bold;">
                  ${fallbackBoleto.status}
                </td>
              </tr>
            </table>
          </div>
        `;
      } else {
        boletoHtml = `
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <h3 style="color: #b45309; margin: 0 0 6px 0; font-size: 15px;">
              ⚠️ Atenção: Nenhum boleto associado
            </h3>
            <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.4;">
              Esta ação de investimento foi concluída pelo gerente comercial, mas <strong>não foi associada a nenhum boleto do Financeiro</strong> no momento da apuração.
            </p>
          </div>
        `;
      }
    }

    // 9. Comprovante/Evidência link
    let documentoHtml = "";
    if (documentoSignedUrl) {
      documentoHtml = `
        <div style="margin-top: 15px;">
          <span style="font-size: 13px; color: #475569; font-weight: 500;">Acordo/Evidência Anexada:</span>
          <a href="${documentoSignedUrl}" target="_blank" style="color: #b45309; font-weight: bold; text-decoration: underline; font-size: 13px; margin-left: 5px;">
            Visualizar Documento
          </a>
          <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280; font-style: italic;">
            (Link seguro e válido por 30 dias)
          </p>
        </div>
      `;
    } else {
      documentoHtml = `
        <div style="margin-top: 15px; color: #ef4444; font-size: 13px; font-weight: 500;">
          Nenhum arquivo de acordo/evidência foi anexado.
        </div>
      `;
    }

    // 10. Assunto e HTML do E-mail
    const subject = `Apuração Concluída — Ação #${acao.codigo || acao.id} — ${acao.rede}`;
    const htmlBody = `
      <div style="font-family: sans-serif; color: #374151; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Header -->
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px;">
          <h2 style="color: #b45309; margin: 0; font-size: 24px; font-weight: 800;">Coffee++ Mais</h2>
          <p style="color: #6b7280; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Apuração de Investimento Finalizada pelo Gerente</p>
        </div>

        <p style="font-size: 15px; line-height: 1.5; color: #1f2937;">
          Olá,
        </p>
        <p style="font-size: 15px; line-height: 1.5; color: #1f2937; margin-bottom: 20px;">
          A **Apuração Comercial** da ação de investimento a seguir foi **concluída com sucesso** e está pronta para verificação.
        </p>

        <!-- Boleto Info / Alerta -->
        ${boletoHtml}

        <!-- Resultado da Apuração -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #334155; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            📊 Resultado da Apuração Comercial
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500; width: 40%;">Número do Acordo:</td>
              <td style="padding: 4px 0; color: #1f2937; font-weight: bold;">${acao.apuracao_numero_acordo || "-"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500;">Qtd. Vendida (Sell-out):</td>
              <td style="padding: 4px 0; color: #1f2937; font-weight: bold;">${acao.apuracao_qtd_vendida !== null ? acao.apuracao_qtd_vendida : "-"}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500;">Valor Projetado (Comercial):</td>
              <td style="padding: 4px 0; color: #1f2937;">${formatCurrency(valorProjetadoTotal)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500;">Valor Realizado (Apuração):</td>
              <td style="padding: 4px 0; color: #059669; font-weight: bold; font-size: 14px;">${formatCurrency(acao.apuracao_valor_realizado)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500;">Concluída por:</td>
              <td style="padding: 4px 0; color: #1f2937;">${acao.apuracao_preenchida_por}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #475569; font-weight: 500;">Data/Hora da Apuração:</td>
              <td style="padding: 4px 0; color: #1f2937;">${formatDateTime(acao.apuracao_preenchida_em)}</td>
            </tr>
          </table>
          ${documentoHtml}
        </div>

        <!-- Detalhes Gerais da Ação -->
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
            📝 Detalhes Gerais do Planejamento
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <tr>
              <td style="padding: 4px 0; color: #4b5563; width: 40%;">Código da Ação:</td>
              <td style="padding: 4px 0; color: #111827; font-weight: bold; font-family: monospace;">#${acao.codigo || acao.id}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Rede / Matriz:</td>
              <td style="padding: 4px 0; color: #111827; font-weight: bold;">${acao.rede} ${acao.codigo_matriz ? `(${acao.codigo_matriz})` : ""}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Tipo de Ação:</td>
              <td style="padding: 4px 0; color: #111827;">${acao.tipo_acao}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Mês de Referência:</td>
              <td style="padding: 4px 0; color: #111827;">${formatMesReferencia(acao.mes_referencia)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Abrangência:</td>
              <td style="padding: 4px 0; color: #111827;">${acao.abrangencia}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Tipo de Pagamento:</td>
              <td style="padding: 4px 0; color: #111827;">${acao.tipo_pagamento}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #4b5563;">Período da Ação:</td>
              <td style="padding: 4px 0; color: #111827;">${formatDate(acao.data_inicio)} a ${formatDate(acao.data_fim)}</td>
            </tr>
          </table>

          <!-- Detalhes SKU / Família -->
          ${detalhesInvestimentoHtml}
        </div>

        <!-- Rodapé do Email -->
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
        <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
          Este é um e-mail automático enviado pelo sistema de gestão de investimentos <strong>Coffee++ Mais</strong>.<br/>
          Não responda diretamente a este e-mail.
        </p>
      </div>
    `;

    // 11. Disparar o e-mail
    console.log(`[Email Apuração] Enviando notificação para: ${recipients}`);
    const info = await transporter.sendMail({
      from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
      to: recipients,
      subject: subject,
      html: htmlBody,
    });
    console.log(`[Email Apuração] E-mail enviado com sucesso! Message ID: ${info.messageId}`);

  } catch (err) {
    console.error("[Email Apuração] Erro crítico ao processar/enviar e-mail de apuração:", err);
  }
}

// ─── Fase 3: Apuração Comercial (Dossiê) ────────────────────────────────

export async function preencherApuracao(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const apuracao_numero_acordo = formData.get("apuracao_numero_acordo") as string;
  const apuracao_qtd_vendida = parseInt(formData.get("apuracao_qtd_vendida") as string) || null;
  const apuracao_valor_realizado = parseFloat((formData.get("apuracao_valor_realizado") as string)?.replace(',', '.') || '0') || null;
  const vinculosStr = formData.get("vinculos_boletos") as string || "[]";
  const vinculos = JSON.parse(vinculosStr) as Array<{ boleto_id: string, valor_associado: number }>;
  const apuracao_boleto_id = vinculos[0]?.boleto_id || null;
  
  // Evidências
  const apuracao_evidencias_url = formData.get("apuracao_evidencias_url") as string || null;
  const condicao_pagamento = formData.get("condicao_pagamento") as string || null;
  const sem_boleto = formData.get("sem_boleto") === "true";

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
      condicao_pagamento,
      sem_boleto,
      apuracao_preenchida_em: new Date().toISOString(),
      apuracao_preenchida_por: user?.email || "unknown"
    })
    .eq("id", id)
    .eq("fase_atual", 3);

  if (error) {
    console.error("Erro ao preencher apuração:", error);
    throw new Error("Falha ao salvar apuração.");
  }

  // Deletar vínculos de boletos existentes para esta ação
  await supabase
    .from("cm_acoes_boletos_vinculo")
    .delete()
    .eq("acao_id", id);

  // Inserir os novos vínculos de boletos
  if (vinculos.length > 0) {
    const insertRows = vinculos.map(v => ({
      acao_id: id,
      boleto_id: v.boleto_id,
      valor_associado: v.valor_associado
    }));
    const { error: linkError } = await supabase
      .from("cm_acoes_boletos_vinculo")
      .insert(insertRows);
    if (linkError) {
      console.error("Erro ao salvar vínculos de boletos:", linkError);
      throw new Error("Falha ao salvar os vínculos dos boletos.");
    }
  }

  // Disparar e-mail de notificação (aguardado para garantir execução estável na Vercel)
  try {
    await enviarEmailNotificacaoApuracao(id, user?.email || "unknown", apuracao_boleto_id);
  } catch (mailErr) {
    console.error("Falha ao enviar e-mail de notificação de apuração:", mailErr);
  }

  revalidatePath("/investimento");
}

// ─── Fase 4: Conferência pelo Trade ─────────────────────────────────────

export async function conferirTrade(id: string, aprovado: boolean, observacao?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  const updateData: any = {
    trade_conferido_em: new Date().toISOString(),
    trade_conferido_por: user?.email || "unknown",
    trade_conferencia_aprovado: aprovado,
    trade_conferencia_observacao: observacao || null,
  };

  if (aprovado) {
    // Fetch current action state for approved_snapshot
    const { data: currentAction } = await supabase
      .from("cm_acoes_investimento")
      .select("*")
      .eq("id", id)
      .single();

    updateData.fase_atual = 5;
    updateData.approved_snapshot = currentAction || null;
    updateData.approved_alerts_snapshot = currentAction?.alertas_preventivos || null;
    updateData.approved_by = user.id;
    updateData.approved_at = new Date().toISOString();
    updateData.approval_comment = observacao || null;
  } else {
    if (!observacao?.trim()) {
      throw new Error("Motivo da reprovação é obrigatório.");
    }
    // Reprovado → volta para Fase 3 (Gerente refaz apuração)
    updateData.fase_atual = 3;
    updateData.rejection_reason = observacao;
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

  // Se devolvido pelo financeiro, enviar notificação por e-mail
  if (!aprovado) {
    try {
      const adminClient = createAdminClient();
      
      // 1. Obter detalhes da ação usando a view que traz o gerente responsável
      const { data: actionView } = await supabase
        .from("v_acoes_investimento_com_gerente")
        .select("*")
        .eq("id", id)
        .single();

      if (actionView) {
        // 2. Tentar obter o e-mail do gerente regional responsável
        let managerEmail = "";
        if (actionView.gerente_responsavel) {
          const { data: profile } = await adminClient
            .from("cm_user_profiles")
            .select("id")
            .eq("manager_name", actionView.gerente_responsavel)
            .maybeSingle();

          if (profile?.id) {
            const { data: { user: managerUser }, error: userError } = await adminClient.auth.admin.getUserById(profile.id);
            if (!userError && managerUser) {
              managerEmail = managerUser.email || "";
            }
          }
        }

        // 3. Enviar e-mail de alerta
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          // Configurar destinatários
          const recipientsSet = new Set<string>();
          recipientsSet.add("trade@coffeemais.com");
          if (managerEmail && managerEmail.includes("@")) {
            recipientsSet.add(managerEmail);
          }
          const recipients = Array.from(recipientsSet).join(", ");

          const formatCurrency = (val: number | null | undefined) => {
            if (val === null || val === undefined) return "R$ 0,00";
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
          };

          const getValorTotal = (r: any) => {
            if (r.abrangencia === "SKU" && r.skus_detalhes) {
              return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
            }
            return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
          };

          const subject = `⚠️ AÇÃO DEVOLVIDA PELO FINANCEIRO — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;
          const htmlBody = `
            <div style="font-family: sans-serif; color: #374151; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #ef4444; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #ef4444; margin: 0; font-size: 22px; font-weight: 800;">⚠️ APURAÇÃO DEVOLVIDA</h2>
                <p style="color: #ef4444; margin: 5px 0 0 0; font-size: 14px; font-weight: 700;">Ação Comercial retornada para Apuração (Fase 3)</p>
              </div>

              <p style="font-size: 15px; line-height: 1.5; color: #1f2937;">
                Olá,
              </p>
              <p style="font-size: 15px; line-height: 1.5; color: #1f2937; margin-bottom: 20px;">
                A conferência financeira da ação de investimento para a rede <strong>${actionView.rede}</strong> foi <strong>devolvida pelo Financeiro</strong>.
              </p>

              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #991b1b; font-size: 13.5px; line-height: 1.5;">
                <strong>Motivo da Devolução:</strong><br/>
                ${observacao || "Nenhum motivo específico informado."}
              </div>

              <!-- Detalhes do Investimento -->
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
                  📝 Detalhes da Ação Comercial
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563; width: 40%;">Código da Ação:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: bold; font-family: monospace;">#${actionView.codigo || actionView.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Rede:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: bold;">${actionView.rede}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Gerente Responsável:</td>
                    <td style="padding: 4px 0; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Tipo de Ação:</td>
                    <td style="padding: 4px 0; color: #111827;">${actionView.tipo_acao}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Valor Estimado:</td>
                    <td style="padding: 4px 0; color: #b45309; font-weight: bold;">${formatCurrency(getValorTotal(actionView))}</td>
                  </tr>
                </table>
              </div>

              <!-- Rodapé do Email -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
              <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
                Este é um e-mail automático enviado pelo sistema de gestão de investimentos <strong>Coffee++ Mais</strong>.<br/>
                O gerente responsável deve acessar a plataforma para corrigir a apuração da ação.
              </p>
            </div>
          `;

          await transporter.sendMail({
            from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
            to: recipients,
            subject: subject,
            html: htmlBody,
          });
        }
      }
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de devolução pelo financeiro:", mailErr);
    }
  }

  // Se aprovado pelo financeiro, enviar notificação por e-mail informando o comercial e o trade
  if (aprovado) {
    try {
      const adminClient = createAdminClient();
      
      // 1. Obter detalhes da ação usando a view que traz o gerente responsável
      const { data: actionView } = await supabase
        .from("v_acoes_investimento_com_gerente")
        .select("*")
        .eq("id", id)
        .single();

      if (actionView) {
        // 2. Tentar obter o e-mail do gerente regional responsável
        let managerEmail = "";
        if (actionView.gerente_responsavel) {
          const { data: profile } = await adminClient
            .from("cm_user_profiles")
            .select("id")
            .eq("manager_name", actionView.gerente_responsavel)
            .maybeSingle();

          if (profile?.id) {
            const { data: { user: managerUser }, error: userError } = await adminClient.auth.admin.getUserById(profile.id);
            if (!userError && managerUser) {
              managerEmail = managerUser.email || "";
            }
          }
        }

        // 3. Enviar e-mail de alerta
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
            tls: {
              rejectUnauthorized: false
            }
          });

          // Configurar destinatários
          const recipientsSet = new Set<string>();
          recipientsSet.add("trade@coffeemais.com");
          if (managerEmail && managerEmail.includes("@")) {
            recipientsSet.add(managerEmail);
          }
          const recipients = Array.from(recipientsSet).join(", ");

          const formatCurrency = (val: number | null | undefined) => {
            if (val === null || val === undefined) return "R$ 0,00";
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
          };

          const getValorTotal = (r: any) => {
            if (r.abrangencia === "SKU" && r.skus_detalhes) {
              return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
            }
            return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
          };

          const subject = `✅ AÇÃO APROVADA NA CONFERÊNCIA — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;
          const htmlBody = `
            <div style="font-family: sans-serif; color: #374151; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #10b981; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <!-- Header -->
              <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
                <h2 style="color: #10b981; margin: 0; font-size: 22px; font-weight: 800;">✅ CONFERÊNCIA APROVADA</h2>
                <p style="color: #10b981; margin: 5px 0 0 0; font-size: 14px; font-weight: 700;">Ação Comercial Aprovada e Enviada para Pagamento (Fase 5)</p>
              </div>

              <p style="font-size: 15px; line-height: 1.5; color: #1f2937;">
                Olá,
              </p>
              <p style="font-size: 15px; line-height: 1.5; color: #1f2937; margin-bottom: 20px;">
                A conferência financeira da ação de investimento para a rede <strong>${actionView.rede}</strong> foi <strong>aprovada com sucesso</strong> na etapa de auditoria e enviada para a fase de **Pagamento Financeiro (Fase 5)**.
              </p>

              <!-- Detalhes do Investimento -->
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
                <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
                  📝 Detalhes da Ação Comercial Aprovada
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563; width: 40%;">Código da Ação:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: bold; font-family: monospace;">#${actionView.codigo || actionView.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Rede:</td>
                    <td style="padding: 4px 0; color: #111827; font-weight: bold;">${actionView.rede}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Gerente Responsável:</td>
                    <td style="padding: 4px 0; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Tipo de Ação:</td>
                    <td style="padding: 4px 0; color: #111827;">${actionView.tipo_acao}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #4b5563;">Valor Estimado:</td>
                    <td style="padding: 4px 0; color: #10b981; font-weight: bold;">${formatCurrency(getValorTotal(actionView))}</td>
                  </tr>
                </table>
              </div>

              <!-- Rodapé do Email -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
              <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
                Este é um e-mail automático enviado pelo sistema de gestão de investimentos <strong>Coffee++ Mais</strong>.<br/>
                Nenhuma ação é requerida do comercial neste momento. A ação aguarda processamento de pagamento pelo Financeiro.
              </p>
            </div>
          `;

          await transporter.sendMail({
            from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
            to: recipients,
            subject: subject,
            html: htmlBody,
          });
        }
      }
    } catch (mailErr) {
      console.error("Erro ao enviar e-mail de aprovação pelo financeiro:", mailErr);
    }
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

  // Enviar e-mail de confirmação de pagamento para o gerente e para o trade
  try {
    const adminClient = createAdminClient();
    
    // 1. Obter detalhes da ação usando a view que traz o gerente responsável
    const { data: actionView } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("*")
      .eq("id", id)
      .single();

    if (actionView) {
      // 2. Tentar obter o e-mail do gerente regional responsável
      let managerEmail = "";
      if (actionView.gerente_responsavel) {
        const { data: profile } = await adminClient
          .from("cm_user_profiles")
          .select("id")
          .eq("manager_name", actionView.gerente_responsavel)
          .maybeSingle();

        if (profile?.id) {
          const { data: { user: managerUser }, error: userError } = await adminClient.auth.admin.getUserById(profile.id);
          if (!userError && managerUser) {
            managerEmail = managerUser.email || "";
          }
        }
      }

      // 3. Obter URL temporária do comprovante se houver
      let comprovanteSignedUrl = "";
      if (financeiro_comprovante_url) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("comprovantes_investimento")
          .createSignedUrl(financeiro_comprovante_url, 60 * 60 * 24 * 30); // 30 dias

        if (!signedError && signedData?.signedUrl) {
          comprovanteSignedUrl = signedData.signedUrl;
        }
      }

      // 4. Enviar e-mail se SMTP configurado
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        // Configurar destinatários
        const recipientsSet = new Set<string>();
        recipientsSet.add("trade@coffeemais.com");
        if (managerEmail && managerEmail.includes("@")) {
          recipientsSet.add(managerEmail);
        }
        const recipients = Array.from(recipientsSet).join(", ");

        const formatCurrency = (val: number | null | undefined) => {
          if (val === null || val === undefined) return "R$ 0,00";
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        };

        const getValorTotal = (r: any) => {
          if (r.abrangencia === "SKU" && r.skus_detalhes) {
            return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
          }
          return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
        };

        const subject = `💰 PAGAMENTO REALIZADO — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;
        
        let comprovanteHtml = "";
        if (comprovanteSignedUrl) {
          comprovanteHtml = `
            <div style="margin-top: 15px;">
              <span style="font-size: 13px; color: #475569; font-weight: 500;">Comprovante de Pagamento Anexado:</span>
              <a href="${comprovanteSignedUrl}" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline; font-size: 13px; margin-left: 5px;">
                Visualizar Comprovante
              </a>
              <p style="margin: 5px 0 0 0; font-size: 11px; color: #6b7280; font-style: italic;">
                (Link seguro e válido por 30 dias)
              </p>
            </div>
          `;
        } else {
          comprovanteHtml = `
            <div style="margin-top: 15px; color: #ef4444; font-size: 13px; font-weight: 500;">
              Nenhum comprovante de pagamento foi anexado pelo financeiro.
            </div>
          `;
        }

        const htmlBody = `
          <div style="font-family: sans-serif; color: #374151; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #10b981; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <!-- Header -->
            <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #10b981; margin: 0; font-size: 22px; font-weight: 800;">💰 PAGAMENTO CONFIRMADO</h2>
              <p style="color: #10b981; margin: 5px 0 0 0; font-size: 14px; font-weight: 700;">Ação Comercial Paga e Concluída (Fase 6)</p>
            </div>

            <p style="font-size: 15px; line-height: 1.5; color: #1f2937;">
              Olá,
            </p>
            <p style="font-size: 15px; line-height: 1.5; color: #1f2937; margin-bottom: 20px;">
              Informamos que o pagamento da ação de investimento para a rede <strong>${actionView.rede}</strong> foi <strong>confirmado e realizado</strong> pelo departamento Financeiro. A ação de investimento foi dada como **Concluída**.
            </p>

            <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #065f46; font-size: 13.5px; line-height: 1.5;">
              <strong>Observações do Financeiro:</strong><br/>
              ${financeiro_observacoes || "Nenhuma observação informada."}
            </div>

            <!-- Detalhes do Investimento -->
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
              <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
                📝 Detalhes da Ação Comercial Paga
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <tr>
                  <td style="padding: 4px 0; color: #4b5563; width: 40%;">Código da Ação:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: bold; font-family: monospace;">#${actionView.codigo || actionView.id}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Rede:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: bold;">${actionView.rede}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Gerente Responsável:</td>
                  <td style="padding: 4px 0; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Tipo de Ação:</td>
                  <td style="padding: 4px 0; color: #111827;">${actionView.tipo_acao}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Valor Realizado (Apuração):</td>
                  <td style="padding: 4px 0; color: #059669; font-weight: bold; font-size: 14px;">${formatCurrency(actionView.apuracao_valor_realizado || getValorTotal(actionView))}</td>
                </tr>
              </table>
              ${comprovanteHtml}
            </div>

            <!-- Rodapé do Email -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
            <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              Este é um e-mail automático enviado pelo sistema de gestão de investimentos <strong>Coffee++ Mais</strong>.<br/>
              A ação foi concluída com sucesso no sistema.
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
          to: recipients,
          subject: subject,
          html: htmlBody,
        });
      }
    }
  } catch (mailErr) {
    console.error("Erro ao enviar e-mail de confirmação de pagamento:", mailErr);
  }

  revalidatePath("/investimento");
}

export async function obterRedesMatrizes() {
  const supabase = await createClient();
  
  // PostgREST/Supabase forces a max limit of 1000 rows on client/API requests.
  // We use range queries to fetch all pages dynamically.
  const { data: page1, error: error1 } = await supabase
    .from("v_redes_matrizes_detalhes")
    .select("codigo, nome, canal")
    .order("nome", { ascending: true })
    .range(0, 999);

  const { data: page2, error: error2 } = await supabase
    .from("v_redes_matrizes_detalhes")
    .select("codigo, nome, canal")
    .order("nome", { ascending: true })
    .range(1000, 1999);

  if (error1) {
    console.error("Erro ao carregar redes matrizes (pág 1):", error1);
    return [];
  }
  
  const allRedes = [...(page1 || []), ...(page2 || [])];
  return allRedes;
}

export async function importarInvestimentosEmLote(acoes: any[]) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .insert(acoes);

  if (error) {
    console.error("Erro ao importar investimentos em lote:", error);
    throw new Error(`Erro ao importar registros: ${error.message}`);
  }

  revalidatePath("/investimento");
  revalidatePath("/investimento/planejamento");
  return { success: true, count: acoes.length };
}

export async function promoverPlanejamento(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      is_planejamento: false,
      fase_atual: 1,
      created_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao promover planejamento para investimento oficial:", error);
    throw new Error("Falha ao promover investimento.");
  }

  revalidatePath("/investimento");
  revalidatePath("/investimento/planejamento");
  return { success: true };
}

export async function marcarAcaoNaoAconteceu(id: string, motivo: string) {
  if (!motivo || !motivo.trim()) {
    throw new Error("Motivo do cancelamento é obrigatório.");
  }
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Obter detalhes da ação usando a view que traz o gerente responsável
    const { data: actionView, error: fetchError } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !actionView) {
      throw new Error(`Ação não encontrada: ${fetchError?.message}`);
    }

    // 2. Tentar obter o e-mail do gerente regional responsável
    let managerEmail = "";
    if (actionView.gerente_responsavel) {
      const { data: profile } = await adminClient
        .from("cm_user_profiles")
        .select("id")
        .eq("manager_name", actionView.gerente_responsavel)
        .maybeSingle();

      if (profile?.id) {
        const { data: { user }, error: userError } = await adminClient.auth.admin.getUserById(profile.id);
        if (!userError && user) {
          managerEmail = user.email || "";
        }
      }
    }

    // 3. Atualizar a ação no banco para retornar à Fase 1 (Planejamento) e Rascunho
    const { error: updateError } = await supabase
      .from("cm_acoes_investimento")
      .update({
        fase_atual: 1,
        is_planejamento: true,
        checklist_comunicacao: false,
        checklist_logistica: false,
        checklist_auditoria: false,
        checklist_garantia: false,
        checklist_conferencia: false,
        trade_validado_em: null,
        trade_validado_por: null,
        cancel_reason: motivo,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Erro ao reverter ação para fase 1:", updateError);
      throw new Error("Erro ao reverter status da ação.");
    }

    // 4. Enviar e-mail de alerta
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        // Configurar destinatários
        const recipientsSet = new Set<string>();
        recipientsSet.add("trade@coffeemais.com");
        recipientsSet.add("cristiano.santos@coffeemais.com");
        if (managerEmail && managerEmail.includes("@")) {
          recipientsSet.add(managerEmail);
        }
        const recipients = Array.from(recipientsSet).join(", ");

        const formatCurrency = (val: number | null | undefined) => {
          if (val === null || val === undefined) return "R$ 0,00";
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        };

        const getValorTotal = (r: any) => {
          if (r.abrangencia === "SKU" && r.skus_detalhes) {
            return r.skus_detalhes.reduce((acc: number, curr: any) => acc + ((Number(curr.investimento) || 0) * (Number(curr.expectativa_volume) || 0)), 0);
          }
          return (Number(r.valor_investimento) || 0) * (Number(r.expectativa_volume) || 0);
        };

        const subject = `⚠️ AÇÃO NÃO ACONTECEU — Rota de Revisão — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;
        const htmlBody = `
          <div style="font-family: sans-serif; color: #374151; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #ef4444; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            
            <!-- Header -->
            <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 15px; margin-bottom: 20px;">
              <h2 style="color: #ef4444; margin: 0; font-size: 22px; font-weight: 800;">⚠️ ALERTA DE EVIDÊNCIA</h2>
              <p style="color: #ef4444; margin: 5px 0 0 0; font-size: 14px; font-weight: 700;">Ação Comercial não foi ao Ar</p>
            </div>

            <p style="font-size: 15px; line-height: 1.5; color: #1f2937;">
              Olá <strong>${actionView.gerente_responsavel || "Gerente Regional"}</strong>,
            </p>
            <p style="font-size: 15px; line-height: 1.5; color: #1f2937; margin-bottom: 20px;">
              Informamos que a verba comercial registrada para a rede <strong>${actionView.rede}</strong> foi sinalizada pelo Trade Marketing como <strong>NÃO EXECUTADA/NÃO FOI AO AR</strong> no PDV.
            </p>

            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #991b1b; font-size: 13.5px; line-height: 1.5;">
              <strong>O que acontece agora?</strong><br/>
              Esta ação foi devolvida para a sua esteira de <strong>Planejamento (Fase 1) como Rascunho</strong>. Você deve acessar o painel de investimentos, revisar as datas/valores ou reprogramar a ação junto ao cliente.
            </div>

            <!-- Detalhes do Investimento -->
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
              <h3 style="color: #374151; margin: 0 0 10px 0; font-size: 15px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">
                📝 Detalhes da Ação Comercial Revertida
              </h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <tr>
                  <td style="padding: 4px 0; color: #4b5563; width: 40%;">Código da Ação:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: bold; font-family: monospace;">#${actionView.codigo || actionView.id}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Rede:</td>
                  <td style="padding: 4px 0; color: #111827; font-weight: bold;">${actionView.rede}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Tipo de Ação:</td>
                  <td style="padding: 4px 0; color: #111827;">${actionView.tipo_acao}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Abrangência:</td>
                  <td style="padding: 4px 0; color: #111827;">${actionView.abrangencia}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Valor Estimado:</td>
                  <td style="padding: 4px 0; color: #b45309; font-weight: bold;">${formatCurrency(getValorTotal(actionView))}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; color: #4b5563;">Mês Referência:</td>
                  <td style="padding: 4px 0; color: #111827;">${actionView.mes_referencia || "-"}</td>
                </tr>
              </table>
            </div>

            <!-- Rodapé do Email -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
            <p style="text-align: center; margin: 0; font-size: 11px; color: #9ca3af; line-height: 1.5;">
              Este é um e-mail automático enviado pelo sistema de gestão de investimentos <strong>Coffee++ Mais</strong>.<br/>
              Por favor, acesse a plataforma para revisar as pendências de rascunhos.
            </p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Gestão Coffee Mais" <${process.env.SMTP_USER}>`,
          to: recipients,
          subject: subject,
          html: htmlBody,
        });
      } catch (mailErr) {
        console.error("Erro ao enviar e-mail de ação não realizada:", mailErr);
      }
    }

    revalidatePath("/investimento");
    revalidatePath("/investimento/planejamento");
    return { success: true };
  } catch (error) {
    console.error("Erro na action marcarAcaoNaoAconteceu:", error);
    throw error;
  }
}

export async function reabrirAcaoInvestimento(id: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado.");

  if (!reason || !reason.trim()) {
    throw new Error("Motivo da reabertura é obrigatório.");
  }

  // Check role
  const { data: profile } = await supabase
    .from("cm_user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const roleLower = profile?.role?.toLowerCase();
  if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "diretor") {
    throw new Error("Apenas Admin, Diretores ou CEO podem reabrir uma ação aprovada.");
  }

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      is_reopened: true,
      reopened_by: user.id,
      reopened_at: new Date().toISOString(),
      reopened_reason: reason
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao reabrir ação:", error);
    throw new Error("Falha ao reabrir ação.");
  }

  // Record reopened audit log manually
  await supabase.from("cm_audit_logs").insert({
    table_name: "cm_acoes_investimento",
    action: "REOPEN",
    user_id: user.id,
    new_data: { id, reopened_reason: reason }
  });

  revalidatePath("/investimento");
  return { success: true };
}

export async function fecharAcaoInvestimento(
  id: string, 
  data: { 
    real_volume: number; 
    real_faturamento: number; 
    real_margem: number;
    action_result: string;
    post_action_notes: string;
    execution_score?: number;
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado.");

  // Fetch the current action to get total investment
  const { data: action } = await supabase
    .from("cm_acoes_investimento")
    .select("valor_investimento, abrangencia, familias_detalhes, skus_detalhes")
    .eq("id", id)
    .single();

  if (!action) throw new Error("Ação não encontrada.");

  // Calculate investment
  let totalInvestment = Number(action.valor_investimento) || 0;
  if (totalInvestment === 0) {
    if (action.abrangencia === "Família" && Array.isArray(action.familias_detalhes)) {
      totalInvestment = action.familias_detalhes.reduce((acc: number, f: any) => acc + (Number(f.investimento) || 0) * (Number(f.expectativa_volume) || 0), 0);
    } else if (action.abrangencia === "SKU" && Array.isArray(action.skus_detalhes)) {
      totalInvestment = action.skus_detalhes.reduce((acc: number, s: any) => acc + (Number(s.investimento) || 0) * (Number(s.expectativa_volume) || 0), 0);
    }
  }

  const roi = totalInvestment > 0 ? (data.real_margem / totalInvestment) : 0;

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      real_volume: data.real_volume,
      real_faturamento: data.real_faturamento,
      real_margem: data.real_margem,
      roi: roi,
      roi_mode: "MANUAL",
      action_result: data.action_result,
      post_action_notes: data.post_action_notes,
      execution_score: data.execution_score !== undefined ? data.execution_score : null,
      fase_atual: 6 // Set to Completed (Concluído)
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao fechar ação:", error);
    throw new Error("Falha ao salvar dados de ROI pós-ação.");
  }

  revalidatePath("/investimento");
  return { success: true };
}
