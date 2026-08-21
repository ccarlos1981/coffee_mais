"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import nodemailer from "nodemailer";
import { cleanMatrixCode, excelSerialToDate, parseDateString, parseExcelNum } from "@/lib/utils/excel-import";
import { calcularCamposConsolidadosInvestimento } from "@/lib/investimento/consolidacao";
import { ActionResult, ActionErrorCode, successResult, errorResult, handleActionError } from "@/lib/types/action-result";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth, requireApprovedProfile, requirePermission } from "@/lib/supabase/auth-helpers";
import { PRODUCT_FAMILIES } from "@/lib/investimento/constants";
import { resolveNotificationRecipients } from "@/lib/investimento/notification-service";

// --- Divergência Operacional de Calendário ---
import { MotivoDivergencia } from "../divergencia-constants";
// --- fim Divergência ---

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

async function logServerError(functionName: string, payload: any, error: any): Promise<string> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let userEmail = "anonymous";
  let userId = "anonymous";
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userEmail = user.email || "unknown";
      userId = user.id;
    }
  } catch (_) {}

  console.error("STRUCTURED_SERVER_ERROR:", JSON.stringify({
    timestamp: new Date().toISOString(),
    requestId,
    functionName,
    userId,
    userEmail,
    payload,
    errorMessage: error?.message || String(error),
    errorStack: error?.stack || null
  }, null, 2));

  return requestId;
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

  // 1. Desconto acima de 10%
  items.forEach((item) => {
    const flat = Number(item.details.preco_flat) || 0;
    const acao = Number(item.details.preco_acao) || 0;
    if (flat > 0) {
      const desc = (flat - acao) / flat;
      if (desc > 0.10) {
        alertas.push({
          tipo: "DESCONTO_ALTO",
          mensagem: `Atenção: Desconto de ${(desc * 100).toFixed(0)}% em ${item.label} ultrapassa o limite institucional de 10%.`,
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

export async function criarAcaoInvestimento(formData: FormData): Promise<ActionResult<any>> {
  const rede = formData.get("rede") as string;
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const data_inicio = formData.get("data_inicio") as string;
  
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Investimento");

    const supabase = await createClient();

    const codigo_matriz = formData.get("codigo_matriz") as string;
    const gerenteName = formData.get("gerente") as string;

    let gerenteId: string | null = null;
    let isFallbackManager = false;
    let clientManagerId: string | null = null;
    let clientManagerName: string | null = null;

    if (codigo_matriz) {
      const cleanCode = cleanMatrixCode(codigo_matriz);
      const codeOr = `codigo_matriz.eq.${cleanCode},codigo_matriz.eq.${cleanCode}.0,codigo_matriz.eq.${codigo_matriz}`;

      if (rede) {
        const { data: clientDataWithRede } = await supabase
          .from("cm_clientes")
          .select("manager_id, manager_name, responsavel")
          .or(codeOr)
          .ilike("matriz", rede)
          .not("manager_id", "is", null)
          .limit(1);

        if (clientDataWithRede && clientDataWithRede.length > 0) {
          clientManagerId = clientDataWithRede[0].manager_id;
          clientManagerName = clientDataWithRede[0].manager_name || clientDataWithRede[0].responsavel;
        }
      }

      if (!clientManagerId) {
        const { data: clientData } = await supabase
          .from("cm_clientes")
          .select("manager_id, manager_name, responsavel")
          .or(codeOr)
          .not("manager_id", "is", null)
          .limit(1);

        if (clientData && clientData.length > 0) {
          clientManagerId = clientData[0].manager_id;
          clientManagerName = clientData[0].manager_name || clientData[0].responsavel;
        } else {
          const { data: anyClient } = await supabase
            .from("cm_clientes")
            .select("manager_id, manager_name, responsavel")
            .or(codeOr)
            .limit(1);
          if (anyClient && anyClient.length > 0) {
            clientManagerId = anyClient[0].manager_id;
            clientManagerName = anyClient[0].manager_name || anyClient[0].responsavel;
          }
        }
      }
    }

    if (clientManagerId) {
      const { data: profileByCode } = await supabase
        .from("cm_user_profiles")
        .select("id")
        .eq("employee_code", clientManagerId)
        .limit(1)
        .maybeSingle();
      if (profileByCode) {
        gerenteId = profileByCode.id;
      }
    }

    if (!gerenteId && clientManagerName) {
      const { data: profileByName } = await supabase
        .from("cm_user_profiles")
        .select("id")
        .ilike("name", `${clientManagerName}%`)
        .limit(1)
        .maybeSingle();
      if (profileByName) {
        gerenteId = profileByName.id;
      }
    }

    if (!gerenteId && gerenteName) {
      const { data: profileByForm } = await supabase
        .from("cm_user_profiles")
        .select("id")
        .ilike("name", `${gerenteName}%`)
        .limit(1)
        .maybeSingle();
      if (profileByForm) {
        gerenteId = profileByForm.id;
      }
    }

    if (!gerenteId) {
      gerenteId = "77777777-7777-7777-7777-777777777777";
      isFallbackManager = true;
    }

    const data_fim = formData.get("data_fim") as string;
    const tipo_acao = formData.get("tipo_acao") as string;
    const tipo_acao_detalhe = (formData.get("tipo_acao_detalhe") as string) || "Ação de Vendas";
    const mes_referencia = formData.get("mes_referencia") as string;
    const date_mode = (formData.get("date_mode") as string) || "single";
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

    if (!rede || (date_mode === "single" && (!data_inicio || !data_fim)) || !tipo_acao || !mes_referencia) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Os campos Matriz, Mês de Referência, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
    }

    if ((!familias_detalhes || familias_detalhes.length === 0) && (!skus_detalhes || skus_detalhes.length === 0)) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Ao menos uma família ou um SKU deve ser selecionado.");
    }

    let calculated_data_inicio = data_inicio;
    let calculated_data_fim = data_fim;

    if (date_mode === "multiple") {
      const dates: string[] = [];
      if (familias_detalhes && familias_detalhes.length > 0) {
        for (const f of familias_detalhes) {
          if (!f.start_date || !f.end_date) {
            return errorResult(ActionErrorCode.VALIDATION_ERROR, `A família ${f.familia_nome} precisa ter Data Início e Data Fim definidas.`);
          }
          dates.push(f.start_date, f.end_date);
        }
      }
      if (skus_detalhes && skus_detalhes.length > 0) {
        for (const s of skus_detalhes) {
          if (!s.start_date || !s.end_date) {
            return errorResult(ActionErrorCode.VALIDATION_ERROR, `O SKU ${s.sku} precisa ter Data Início e Data Fim definidas.`);
          }
          dates.push(s.start_date, s.end_date);
        }
      }
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        calculated_data_inicio = sorted[0];
        calculated_data_fim = sorted[sorted.length - 1];
      } else {
        return errorResult(ActionErrorCode.VALIDATION_ERROR, "Ao menos um item com período definido deve ser selecionado no modo Múltiplas Datas.");
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
        if (f.preco_acao && f.preco_flat && Number(f.preco_acao) > Number(f.preco_flat)) {
          return errorResult(ActionErrorCode.VALIDATION_ERROR, `Família ${f.familia_nome}: Preço Ação (${f.preco_acao}) não pode ser maior que Preço Flat (${f.preco_flat}).`);
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
        if (s.preco_acao && s.preco_flat && Number(s.preco_acao) > Number(s.preco_flat)) {
          return errorResult(ActionErrorCode.VALIDATION_ERROR, `SKU ${s.sku}: Preço Ação (${s.preco_acao}) não pode ser maior que Preço Flat (${s.preco_flat}).`);
        }
        if (s.investimento_manual) {
          const { data: { user } } = await supabase.auth.getUser();
          s.investimento_override_by = user?.id || null;
        }
      }
    }

    const is_planejamento = formData.get("is_planejamento") === "true";

    // 1. Fetch SKU conversion info to map SKUs to families dynamically
    const { data: skuProducts } = await supabase
      .from("v_produtos_detalhes")
      .select("codigo_integracao, product_type");
    const skuFamilyMap = new Map<string, string>();
    if (skuProducts) {
      for (const p of skuProducts) {
        if (p.codigo_integracao && p.product_type) {
          skuFamilyMap.set(p.codigo_integracao, p.product_type);
        }
      }
    }

    // 2. Build independent actions based on grid rows (1 grid row = 1 action)
    const actionsToInsert: any[] = [];

    if (abrangencia === "Família" || abrangencia === "Misto") {
      // Loop over each family row in familias_detalhes (1 grid row = 1 action)
      for (const f of (familias_detalhes || [])) {
        const famName = f.familia_nome || f.familia_id;
        
        // Filter SKUs corresponding to this family
        const sDet = (skus_detalhes || []).filter((s: any) => skuFamilyMap.get(s.sku) === famName);

        // Calculate consolidated values for this single family row action
        const {
          familia_produto,
          preco_flat,
          preco_acao,
          valor_investimento,
          expectativa_volume
        } = calcularCamposConsolidadosInvestimento([f], sDet, famName);

        const action_alertas = await avaliarAlertasAcaoInvestimento(
          supabase,
          sDet.length > 0 ? "Misto" : "Família",
          [f],
          sDet,
          rede,
          codigo_matriz
        );

        actionsToInsert.push({
          rede,
          codigo_matriz: codigo_matriz || null,
          data_inicio: f.start_date || calculated_data_inicio,
          data_fim: f.end_date || calculated_data_fim,
          date_mode: "single",
          tipo_acao,
          tipo_acao_detalhe,
          familia_produto,
          familias_detalhes: [f], // Single-item array for retrocompatibility
          preco_flat,
          preco_acao,
          valor_investimento,
          expectativa_volume,
          abrangencia: sDet.length > 0 ? "Misto" : "Família",
          tipo_pagamento,
          skus_detalhes: sDet,
          mes_referencia,
          fase_atual: 1,
          is_planejamento,
          alertas_preventivos: action_alertas,
          status_financeiro: "NAO_FATURADA"
        });
      }
    } else if (abrangencia === "SKU") {
      // Loop over each SKU row in skus_detalhes (1 grid row = 1 action)
      for (const s of (skus_detalhes || [])) {
        const famName = skuFamilyMap.get(s.sku) || "Outros";

        // Calculate consolidated values for this single SKU row action
        const {
          familia_produto,
          preco_flat,
          preco_acao,
          valor_investimento,
          expectativa_volume
        } = calcularCamposConsolidadosInvestimento(null, [s], s.sku);

        const action_alertas = await avaliarAlertasAcaoInvestimento(
          supabase,
          "SKU",
          [],
          [s],
          rede,
          codigo_matriz
        );

        actionsToInsert.push({
          rede,
          codigo_matriz: codigo_matriz || null,
          data_inicio: s.start_date || calculated_data_inicio,
          data_fim: s.end_date || calculated_data_fim,
          date_mode: "single",
          tipo_acao,
          tipo_acao_detalhe,
          familia_produto: famName,
          familias_detalhes: [{
            familia_id: famName,
            familia_nome: famName,
            preco_flat,
            preco_acao,
            investimento: valor_investimento,
            expectativa_volume,
            start_date: s.start_date || calculated_data_inicio,
            end_date: s.end_date || calculated_data_fim,
            status_trade: "PENDENTE"
          }], // Single-item array for retrocompatibility
          preco_flat,
          preco_acao,
          valor_investimento,
          expectativa_volume,
          abrangencia: "SKU",
          tipo_pagamento,
          skus_detalhes: [s],
          mes_referencia,
          fase_atual: 1,
          is_planejamento,
          alertas_preventivos: action_alertas,
          status_financeiro: "NAO_FATURADA"
        });
      }
    }

    if (actionsToInsert.length === 0) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Ao menos uma ação válida deve ser gerada a partir do lançamento.");
    }

    // 3. Execute transactional insert via Postgres RPC
    const p_campanha = {
      nome_campanha: `Campanha ${rede} - ${mes_referencia}`,
      rede,
      codigo_matriz: codigo_matriz || null,
      mes_referencia,
      status_operacional: "PLANEJAMENTO",
      status_financeiro: "ABERTA",
      gerente_id: gerenteId || null
    };

    const adminClient = createAdminClient();
    const { data: rpcResult, error: rpcError } = await adminClient.rpc("criar_campanha_e_acoes_v2", {
      p_campanha,
      p_acoes: actionsToInsert
    });

    if (rpcError) {
      console.error("Erro na transação de criação de campanha/ações:", rpcError);
      throw rpcError;
    }

    if (isFallbackManager) {
      try {
        await supabase.from("cm_audit_logs").insert({
          table_name: "cm_campanhas",
          action: "CAMPAIGN_MANAGER_FALLBACK",
          user_id: user.id,
          new_data: {
            campanha_id: (rpcResult as any)?.campanha_id,
            rede,
            codigo_matriz,
            gerente_id: gerenteId,
            detalhe: "Ownership comercial de investimento criado via fallback automático (Inside Sales) devido a ausência de gerente no cadastro mestre."
          }
        });
      } catch (logErr) {
        console.error("Falha ao registrar log de auditoria de fallback de gerente:", logErr);
      }
    }

    revalidatePath("/investimento");
    revalidatePath("/investimento/planejamento");
    return successResult({ is_planejamento });
  } catch (err: any) {
    const requestId = await logServerError("criarAcaoInvestimento", { rede, abrangencia, data_inicio }, err);
    return errorResult(
      ActionErrorCode.INTERNAL_ERROR,
      `Erro inesperado no servidor. Incident ID: ${requestId}.`,
      requestId
    );
  }
}

export async function atualizarAcaoInvestimento(id: string, formData: FormData): Promise<ActionResult<any>> {
  const rede = formData.get("rede") as string;
  const abrangencia = formData.get("abrangencia") as string || "Família";
  const data_inicio = formData.get("data_inicio") as string;
  
  try {
    const supabase = await createClient();

    const codigo_matriz = formData.get("codigo_matriz") as string;
    const data_fim = formData.get("data_fim") as string;
    const tipo_acao = formData.get("tipo_acao") as string;
    const tipo_acao_detalhe = (formData.get("tipo_acao_detalhe") as string) || "Ação de Vendas";
    const mes_referencia = formData.get("mes_referencia") as string;
    const date_mode = (formData.get("date_mode") as string) || "single";
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

    if (!rede || (date_mode === "single" && (!data_inicio || !data_fim)) || !tipo_acao || !mes_referencia) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Os campos Matriz, Mês de Referência, Data Início, Data Fim e Tipo da Ação são obrigatórios.");
    }

    if ((!familias_detalhes || familias_detalhes.length === 0) && (!skus_detalhes || skus_detalhes.length === 0)) {
      return errorResult(ActionErrorCode.VALIDATION_ERROR, "Ao menos uma família ou um SKU deve ser selecionado.");
    }

    let calculated_data_inicio = data_inicio;
    let calculated_data_fim = data_fim;

    if (date_mode === "multiple") {
      const dates: string[] = [];
      if (familias_detalhes && familias_detalhes.length > 0) {
        for (const f of familias_detalhes) {
          if (!f.start_date || !f.end_date) {
            return errorResult(ActionErrorCode.VALIDATION_ERROR, "Cada família selecionada no modo Múltiplas Datas precisa ter Data Início e Data Fim definidas.");
          }
          dates.push(f.start_date, f.end_date);
        }
      }
      if (skus_detalhes && skus_detalhes.length > 0) {
        for (const s of skus_detalhes) {
          if (!s.start_date || !s.end_date) {
            return errorResult(ActionErrorCode.VALIDATION_ERROR, "Cada SKU selecionado no modo Múltiplas Datas precisa ter Data Início e Data Fim definidas.");
          }
          dates.push(s.start_date, s.end_date);
        }
      }
      if (dates.length > 0) {
        const sorted = [...dates].sort();
        calculated_data_inicio = sorted[0];
        calculated_data_fim = sorted[sorted.length - 1];
      } else {
        return errorResult(ActionErrorCode.VALIDATION_ERROR, "Ao menos um item com período definido deve ser selecionado no modo Múltiplas Datas.");
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
        if (f.preco_acao && f.preco_flat && Number(f.preco_acao) > Number(f.preco_flat)) {
          return errorResult(ActionErrorCode.VALIDATION_ERROR, `Família ${f.familia_nome}: Preço Ação (${f.preco_acao}) não pode ser maior que Preço Flat (${f.preco_flat}).`);
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
        if (s.preco_acao && s.preco_flat && Number(s.preco_acao) > Number(s.preco_flat)) {
          return errorResult(ActionErrorCode.VALIDATION_ERROR, `SKU ${s.sku}: Preço Ação (${s.preco_acao}) não pode ser maior que Preço Flat (${s.preco_flat}).`);
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
      if (!user) return errorResult(ActionErrorCode.UNAUTHORIZED, "Não autorizado.");
      const { data: profile } = await supabase
        .from("cm_user_profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const roleLower = profile?.role?.toLowerCase();
      if (roleLower !== "admin" && roleLower !== "ceo" && roleLower !== "diretor") {
        return errorResult(ActionErrorCode.BUSINESS_RULE_VIOLATION, "Esta ação está aprovada e bloqueada para edição. Somente diretores, CEO ou Admin podem reabrir ou alterar.");
      }
    }

    // Calculate consolidated fields using shared helper
    const {
      familia_produto,
      preco_flat,
      preco_acao,
      valor_investimento,
      expectativa_volume
    } = calcularCamposConsolidadosInvestimento(
      familias_detalhes,
      skus_detalhes,
      formData.get("familia_produto") as string
    );

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
        tipo_acao_detalhe,
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
      throw error;
    }

    revalidatePath("/investimento");
    revalidatePath("/investimento/planejamento");
    return successResult({ is_planejamento });
  } catch (err: any) {
    const requestId = await logServerError("atualizarAcaoInvestimento", { id, rede, abrangencia, data_inicio }, err);
    return errorResult(
      ActionErrorCode.INTERNAL_ERROR,
      `Erro inesperado no servidor. Incident ID: ${requestId}.`,
      requestId
    );
  }
}

// ─── Fase 2: Validação pelo Trade ───────────────────────────────────────

export async function atualizarChecklistTrade(id: string, checklist: {
  comunicacao: boolean;
  logistica: boolean;
  auditoria: boolean;
  garantia: boolean;
  conferencia: boolean;
  sem_auditoria?: boolean;
  divergencia?: {
    possui: boolean;
    motivo?: MotivoDivergencia | null;
    observacao?: string | null;
  };
}) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Validação server-side da divergência (camada 2 de 3)
  const div = checklist.divergencia;
  if (div?.possui) {
    if (!div.motivo || !div.observacao) {
      throw new Error('Preencha todos os campos de divergência de calendário antes de salvar.');
    }
  }

  // Invoca a RPC atômica registrar_excecao_auditoria_trade para salvar o checklist
  const { data: rpcRes, error: rpcErr } = await adminClient.rpc("registrar_excecao_auditoria_trade", {
    p_acao_id: id,
    p_checklist_comunicacao: checklist.comunicacao,
    p_checklist_logistica: checklist.logistica,
    p_checklist_auditoria: checklist.auditoria,
    p_checklist_garantia: checklist.garantia,
    p_checklist_conferencia: checklist.conferencia,
    p_checklist_sem_auditoria: checklist.sem_auditoria ?? false,
    p_possui_divergencia: div?.possui ?? false,
    p_motivo_divergencia: div?.possui ? div.motivo : null,
    p_observacao_divergencia: div?.possui ? div.observacao : null,
    p_user_id: user?.id ?? null,
  });

  if (rpcErr) {
    console.error("[EXCECAO_TRADE] Erro ao atualizar checklist do Trade:", rpcErr);
    const detailMsg = rpcErr.message || rpcErr.details || rpcErr.hint || JSON.stringify(rpcErr);
    throw new Error(`Falha ao salvar checklist do Trade: ${detailMsg}`);
  }
}

export async function enviarParaTrade(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 2,
      devolvido_por: null,
      devolvido_em: null,
      rejection_reason: null,
      is_reopened: false,
      reopened_reason: null,
      reopened_by: null,
      reopened_at: null
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

      const resolvedRecipients = await resolveNotificationRecipients({
        evento: "ENVIAR_TRADE",
        faseAtual: 1,
        faseDestino: 2,
        gerenteEmail: managerEmail
      });
      const recipients = resolvedRecipients.recipientsString;

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

export async function reprovarAcaoTrade(id: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Usuário não autenticado.");

  if (!reason || !reason.trim()) {
    throw new Error("Motivo da reprovação é obrigatório.");
  }

  // 1. Obter estado atual da ação
  const { data: currentAction } = await supabase
    .from("cm_acoes_investimento")
    .select("*")
    .eq("id", id)
    .single();

  if (!currentAction) throw new Error("Ação não encontrada.");

  // 2. Atualizar status e limpar checklists do Trade
  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 1, // Retorna para Fase 1 (Planejamento)
      rejection_reason: reason,
      devolvido_por: 'TRADE',
      devolvido_em: new Date().toISOString(),
      is_reopened: true,
      reopened_by: user.id,
      reopened_at: new Date().toISOString(),
      reopened_reason: 'REABERTA_PELO_TRADE',
      checklist_comunicacao: false,
      checklist_logistica: false,
      checklist_auditoria: false,
      checklist_garantia: false,
      checklist_conferencia: false,
      trade_validado_em: null,
      trade_validado_por: null,
    })
    .eq("id", id)
    .eq("fase_atual", 2);

  if (error) {
    console.error("Erro ao reprovar pelo Trade:", error);
    throw new Error("Falha ao registrar reprovação do Trade.");
  }

  // 3. Registrar Log
  await supabase.from("cm_audit_logs").insert({
    table_name: "cm_acoes_investimento",
    action: "TRADE_REJECT",
    user_id: user.id,
    new_data: { id, rejection_reason: reason }
  });

  // 4. Enviar e-mail de notificação
  try {
    const adminClient = createAdminClient();
    
    // Obter detalhes da ação usando a view com gerente
    const { data: actionView } = await supabase
      .from("v_acoes_investimento_com_gerente")
      .select("*")
      .eq("id", id)
      .single();

    if (actionView && process.env.SMTP_USER && process.env.SMTP_PASS) {
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

      const resolvedRecipients = await resolveNotificationRecipients({
        evento: "REPROVAR_TRADE",
        faseAtual: 2,
        faseDestino: 1,
        gerenteEmail: managerEmail
      });
      const recipients = resolvedRecipients.recipientsString;

      const subject = `⚠️ AÇÃO REPROVADA PELO TRADE — Ação #${actionView.codigo || actionView.id} — ${actionView.rede}`;

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

      // Se houver divergência de calendário operacional
      let divergenciaInfoHtml = "";
      if (currentAction.possui_divergencia_calendario) {
        const motivoLabel = currentAction.motivo_divergencia_calendario || "Não informado";
        const observacaoStr = currentAction.observacao_divergencia || "Nenhuma";
        
        divergenciaInfoHtml = `
          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #78350f;">
            <strong style="font-size: 14px; display: block; margin-bottom: 6px;">⚠️ Divergência Operacional de Calendário Detectada</strong>
            <p style="margin: 4px 0;"><strong>Motivo:</strong> ${motivoLabel}</p>
            <p style="margin: 4px 0;"><strong>Observação:</strong> ${observacaoStr}</p>
            <p style="margin: 8px 0 0 0; font-weight: bold; color: #b45309;">👉 Atenção Gerente Responsável: Por favor, revise e corrija as datas planejadas da ação na Fase 1 (Planejamento) antes de enviar novamente para aprovação.</p>
          </div>
        `;
      }

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 24px 30px;">
            <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 700;">⚠️ Ação Reprovada pelo Trade</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #fee2e2;">A ação retornou para a Fase 1 (Planejamento) para correções.</p>
          </div>

          <div style="padding: 25px 30px;">
            <!-- Action: what just happened -->
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px; color: #991b1b;">
              <strong>Motivo da Reprovação:</strong> ${reason}<br/>
              <span style="font-size: 11px; color: #7f1d1d; display: block; margin-top: 4px;">Reprovado por: <strong>${user?.email || "—"}</strong> em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
            </div>

            <!-- Divergência Info (se aplicável) -->
            ${divergenciaInfoHtml}

            <!-- Detalhes da Ação -->
            <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Dados do Lançamento</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin-bottom: 15px;">
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563; width: 40%;">Rede:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${actionView.rede}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Código da Matriz:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.codigo_matriz || "-"}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Mês Referência:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatMesReferencia(actionView.mes_referencia)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Tipo de Ação:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.tipo_acao} ${actionView.tipo_acao_detalhe ? `(${actionView.tipo_acao_detalhe})` : ""}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Família / SKU:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.abrangencia === "SKU" ? "Múltiplos SKUs" : (actionView.familias_detalhes && actionView.familias_detalhes.length > 0 ? actionView.familias_detalhes.map((f: any) => f.familia_nome).join(", ") : (actionView.familia_produto || "-"))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Período Planejado:</td>
                <td style="padding: 6px 8px; color: #111827;">${formatDate(actionView.data_inicio)} a ${formatDate(actionView.data_fim)}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Valor Investimento:</td>
                <td style="padding: 6px 8px; font-weight: bold; color: #111827;">${formatCurrency(getValorTotal(actionView))}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 6px 8px; color: #4b5563;">Gerente Responsável:</td>
                <td style="padding: 6px 8px; color: #111827;">${actionView.gerente_responsavel || "-"}</td>
              </tr>
            </table>

            <p style="font-size: 11px; color: #6b7280; margin-top: 30px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 15px;">
              Este é um e-mail automático gerado pelo Hub de Investimentos Coffee++. Não responda a este e-mail.
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

      console.log(`[Email Reprovação Trade] Notificação enviada para: ${recipients}`);
    }
  } catch (mailErr) {
    console.error("Erro ao enviar e-mail de reprovação do Trade:", mailErr);
  }

  revalidatePath("/investimento");
  revalidatePath("/investimento/planejamento");
  return { success: true };
}

export async function validarTrade(id: string, checklist: {
  comunicacao: boolean;
  logistica: boolean;
  auditoria: boolean;
  garantia: boolean;
  conferencia: boolean;
  sem_auditoria?: boolean;
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
      checklist_conferencia: checklist.conferencia,
      checklist_sem_auditoria: checklist.sem_auditoria ?? false
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

      const resolvedRecipients = await resolveNotificationRecipients({
        evento: "VALIDAR_TRADE",
        faseAtual: 2,
        faseDestino: 3,
        gerenteEmail: managerEmail
      });
      const recipients = resolvedRecipients.recipientsString;

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

            ${checklist.sem_auditoria ? `
            <!-- Observação Exceção GRV -->
            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #d97706; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #78350f;">
              <strong>Observação:</strong> Esta ação foi aprovada com autorização do GRV, uma vez que não foi possível realizar a auditoria operacional pelo Trade.
            </div>
            ` : ''}

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

    // 5. Destinatários via Serviço Central por Responsabilidade Funcional
    const resolvedRecipients = await resolveNotificationRecipients({
      evento: "CONCLUIR_APURACAO",
      faseAtual: 3,
      faseDestino: 4,
      gerenteEmail: managerEmail
    });
    const recipients = resolvedRecipients.recipientsString;

    // Registrar log de auditoria oficial da comunicação com o Financeiro (Fase 3 -> 4)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from("cm_audit_logs").insert({
        table_name: "cm_acoes_investimento",
        action: "EMAIL_NOTIFY_FINANCEIRO",
        user_id: currentUser?.id || null,
        new_data: {
          acao_id: acaoId,
          fase_anterior: 3,
          fase_destino: 4,
          destinatarios: recipients,
          motivo_envio: "Transição da Fase 3 (Apuração GRV) para Fase 4 (Conferência Financeira)",
          timestamp: new Date().toISOString()
        }
      });
    } catch (auditErr) {
      console.error("[Email Apuração] Falha ao registrar log de auditoria do envio ao Financeiro:", auditErr);
    }

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
              <td style="padding: 4px 0; color: #475569; font-weight: 500; width: 40%;">Dados do Acordo:</td>
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
  
  // Evidências e Observações
  const apuracao_evidencias_url = formData.get("apuracao_evidencias_url") as string || null;
  const condicao_pagamento = formData.get("condicao_pagamento") as string || null;
  const sem_boleto = formData.get("sem_boleto") === "true";
  const post_action_notes = formData.get("post_action_notes") as string || null;

  if (!apuracao_numero_acordo) {
    throw new Error("Dados do Acordo é obrigatório.");
  }

  const { error } = await supabase
    .from("cm_acoes_investimento")
    .update({
      fase_atual: 4,
      devolvido_por: null,
      devolvido_em: null,
      rejection_reason: null,
      apuracao_numero_acordo,
      apuracao_qtd_vendida,
      apuracao_valor_realizado,
      apuracao_boleto_id,
      apuracao_evidencias_url,
      condicao_pagamento,
      sem_boleto,
      post_action_notes,
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
    updateData.devolvido_por = 'FINANCEIRO';
    updateData.devolvido_em = new Date().toISOString();
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

          // Configurar destinatários via serviço por responsabilidade funcional
          const resolvedRecipients = await resolveNotificationRecipients({
            evento: "DEVOLVER_FINANCEIRO",
            faseAtual: 4,
            faseDestino: 3,
            gerenteEmail: managerEmail
          });
          const recipients = resolvedRecipients.recipientsString;

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

          // Configurar destinatários via serviço por responsabilidade funcional
          const resolvedRecipients = await resolveNotificationRecipients({
            evento: "APROVAR_FINANCEIRO",
            faseAtual: 4,
            faseDestino: 5,
            gerenteEmail: managerEmail
          });
          const recipients = resolvedRecipients.recipientsString;

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

  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  const { data: profile } = await supabase
    .from("cm_user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role || "").toLowerCase();
  const isFinanceiroAllowed = ["admin", "admin master", "financeiro", "ceo"].includes(userRole);

  if (!isFinanceiroAllowed) {
    throw new Error("Acesso negado: Confirmação de pagamento é uma operação exclusiva do perfil Financeiro.");
  }

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

        // Configurar destinatários via serviço por responsabilidade funcional
        const resolvedRecipients = await resolveNotificationRecipients({
          evento: "PAGAMENTO_CONFIRMADO",
          faseAtual: 5,
          faseDestino: 6,
          gerenteEmail: managerEmail
        });
        const recipients = resolvedRecipients.recipientsString;

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
  
  // PostgREST/Supabase limits max rows per request.
  // We fetch all pages from cm_clientes directly to guarantee the single source of truth.
  const pageSize = 1000;
  let page = 0;
  const allClients: any[] = [];

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("cm_clientes")
      .select("codigo, codigo_matriz, matriz, tipo_parceiro, uf, regional, responsavel")
      .not("matriz", "is", null)
      .order("matriz", { ascending: true })
      .range(from, to);

    if (error) {
      console.error(`Erro ao carregar matrizes de cm_clientes (pág ${page + 1}):`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allClients.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  // Deduplicação e consolidação de Matrizes a partir do cadastro único cm_clientes
  const matrixMap = new Map<string, {
    codigo: string;
    nome: string;
    canal: string;
    uf?: string | null;
    regional?: string | null;
    gerente?: string | null;
  }>();

  for (const c of allClients) {
    const nome = (c.matriz || "").trim();
    if (!nome) continue;

    const nomeUpper = nome.toUpperCase();
    const rawCodigoMatriz = (c.codigo_matriz || "").trim();
    const codigoMatriz = cleanMatrixCode(rawCodigoMatriz) || (rawCodigoMatriz ? String(rawCodigoMatriz).trim() : "");
    const gerente = (c.responsavel || "").trim() || null;
    const uf = (c.uf || "").trim() || null;
    const regional = (c.regional || "").trim() || null;
    const canal = (c.tipo_parceiro || "").trim() || "Outros";

    // Chave única de agrupamento da Matriz (Deduplica múltiplos clientes/PDVs que compartilham a mesma matriz)
    const key = nomeUpper;

    if (!matrixMap.has(key)) {
      matrixMap.set(key, {
        codigo: codigoMatriz || cleanMatrixCode(c.codigo) || String(c.codigo || ""),
        nome,
        canal,
        uf,
        regional,
        gerente
      });
    } else {
      const existing = matrixMap.get(key)!;
      // Priorizar codigo_matriz oficial se existing tinha apenas código do cliente
      if (codigoMatriz && (!existing.codigo || existing.codigo === cleanMatrixCode(c.codigo) || existing.codigo === String(c.codigo || ''))) {
        existing.codigo = codigoMatriz;
      }
      if (!existing.uf && uf) existing.uf = uf;
      if (!existing.regional && regional) existing.regional = regional;
      if (!existing.gerente && gerente) existing.gerente = gerente;
      if ((existing.canal === "Outros" || !existing.canal) && canal) existing.canal = canal;
    }
  }

  const result = Array.from(matrixMap.values()).sort((a, b) => 
    a.nome.localeCompare(b.nome, 'pt-BR')
  );

  return result;
}

export async function importarInvestimentosEmLote(
  acoes: any[],
  fileName?: string,
  fileHash?: string,
  totalInvestment?: number
): Promise<ActionResult<{ count: number; batchId?: string }>> {
  let userId: string | null = null;
  try {
    const user = await requireAuth();
    const profile = await requireApprovedProfile(user.id);
    await requirePermission(profile.role, "Investimento");
    userId = user.id;

    const supabase = await createClient();

    // Consolida os campos usando a regra unificada de negócio antes de salvar no banco
    const processedAcoes = acoes.map(acaoItem => {
      const consolidados = calcularCamposConsolidadosInvestimento(
        acaoItem.familias_detalhes,
        acaoItem.skus_detalhes,
        acaoItem.familia_produto
      );
      return {
        ...acaoItem,
        ...consolidados
      };
    });

    // Se não foram enviados os metadados de job (retrocompatibilidade legada), faz o insert simples
    if (!fileName || !fileHash) {
      const { error } = await supabase
        .from("cm_acoes_investimento")
        .insert(processedAcoes);

      if (error) {
        console.error("Erro ao importar investimentos em lote (legado):", error);
        throw new Error(`Erro ao importar registros: ${error.message}`);
      }
      revalidatePath("/investimento");
      revalidatePath("/investimento/planejamento");
      return successResult({ count: processedAcoes.length });
    }

    // 1. Prevenir duplicidades verificando se o hash do arquivo já foi importado
    const { data: existingJob, error: checkError } = await supabase
      .from("cm_import_jobs")
      .select("id")
      .eq("file_hash", fileHash)
      .single();

    if (existingJob) {
      return errorResult(
        ActionErrorCode.DUPLICATE_FILE,
        "Este arquivo já foi importado anteriormente."
      );
    }

    // 2. Chamar RPC transacional do PostgreSQL
    const jobPayload = {
      nome_arquivo: fileName,
      file_hash: fileHash,
      registros_count: processedAcoes.length,
      investimento_total: totalInvestment || 0,
      created_by: userId,
      ip_address: null
    };

    const adminClient = createAdminClient();
    const { data: jobId, error: rpcError } = await adminClient.rpc(
      "importar_lote_investimentos",
      {
        job_data: jobPayload,
        acoes_data: processedAcoes
      }
    );

    if (rpcError) {
      console.error("Erro ao importar lote via RPC transacional:", rpcError);
      throw new Error(`Erro ao salvar importação transacional: ${rpcError.message}`);
    }

    revalidatePath("/investimento");
    revalidatePath("/investimento/planejamento");
    return successResult({ count: processedAcoes.length, batchId: jobId });
  } catch (error: any) {
    handleActionError(error, {
      module: "Investimentos",
      action: "importarInvestimentosEmLote",
      userId
    });
  }
}

export async function simularImportacaoInvestimentos(rawRows: any[][]): Promise<ActionResult<{ errors: any[]; summary: any; parsedLines: any[] }>> {
  try {
    if (!rawRows || rawRows.length <= 1) {
      return errorResult(
        ActionErrorCode.EMPTY_FILE,
        "A planilha enviada está vazia."
      );
    }

    const supabase = await createClient();

    // 1. Carregar dados cadastrais em paralelo
    const [
      { data: matrizes, error: mError },
      { data: dbFilters }
    ] = await Promise.all([
      supabase.from("v_redes_matrizes_detalhes").select("codigo, nome, canal, uf, gerente"),
      supabase.rpc("get_dashboard_filters_rpc")
    ]);

    if (mError) {
      console.error("Erro ao carregar matrizes na simulação:", mError);
      throw new Error(`Erro ao carregar redes matrizes: ${mError.message}`);
    }

    const validMatrizes = matrizes || [];
    const validSkus = dbFilters?.produtos || [];
    const validFams = [...PRODUCT_FAMILIES];

    // 2. Mapear cabeçalhos de colunas
    const headers = rawRows[0].map(h => String(h || "").trim().toLowerCase());
    
    const colIndices = {
      codigo_matriz: headers.findIndex(h => h.includes("código") || h.includes("codigo") || h.includes("matriz")),
      rede: headers.findIndex(h => h.includes("rede")),
      uf: headers.findIndex(h => h.includes("uf") || h.includes("estado")),
      gerente: headers.findIndex(h => h.includes("gerente") || h.includes("responsavel")),
      canal: headers.findIndex(h => h.includes("canal")),
      tipo: headers.findIndex(h => h.includes("tipo")),
      pagamento: headers.findIndex(h => h.includes("pagamento")),
      mes: headers.findIndex(h => h.includes("mês") || h.includes("mes") || h.includes("ref")),
      inicio: headers.findIndex(h => h.includes("início") || h.includes("inicio")),
      fim: headers.findIndex(h => h.includes("fim") || h.includes("final")),
      abrangencia: headers.findIndex(h => h === "família ou sku" || h === "familia ou sku" || h.includes("abrangência") || h.includes("abrangencia")),
      familia: headers.findIndex(h => (h.includes("família") || h.includes("familia")) && !h.includes("ou sku")),
      sku: headers.findIndex(h => h.includes("sku") && !h.includes("ou sku")),
      flat: headers.findIndex(h => h.includes("flat")),
      acao: headers.findIndex(h => (h.includes("preço") || h.includes("preco")) && (h.includes("ação") || h.includes("acao"))),
      investimento: headers.findIndex(h => h.includes("investimento") || h.includes("inv")),
      volume: headers.findIndex(h => h.includes("volume") || h.includes("vol"))
    };

    // Validar se cabeçalhos mínimos essenciais existem
    const mandatoryCols = ["codigo_matriz", "tipo", "pagamento", "mes", "inicio", "fim", "abrangencia"];
    const missingCols = mandatoryCols.filter(c => colIndices[c as keyof typeof colIndices] === -1);
    if (missingCols.length > 0) {
      return errorResult(
        ActionErrorCode.MISSING_HEADERS,
        "Cabeçalhos obrigatórios não encontrados na planilha."
      );
    }

    const parsedLines: any[] = [];
    const errors: { line: number; column: string; value: any; message: string }[] = [];

    // 3. Processamento e validação de linhas
    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || cell === "")) {
        continue;
      }

      const rowErrors: string[] = [];
      
      const rawCodigoMatriz = colIndices.codigo_matriz !== -1 ? row[colIndices.codigo_matriz] : "";
      const rawRede = colIndices.rede !== -1 ? row[colIndices.rede] : "";
      const rawUf = colIndices.uf !== -1 ? row[colIndices.uf] : "";
      const rawGerente = colIndices.gerente !== -1 ? row[colIndices.gerente] : "";
      const rawCanal = colIndices.canal !== -1 ? row[colIndices.canal] : "";
      const rawTipo = colIndices.tipo !== -1 ? row[colIndices.tipo] : "";
      const rawPagamento = colIndices.pagamento !== -1 ? row[colIndices.pagamento] : "";
      const rawMes = colIndices.mes !== -1 ? row[colIndices.mes] : "";
      const rawInicio = colIndices.inicio !== -1 ? row[colIndices.inicio] : "";
      const rawFim = colIndices.fim !== -1 ? row[colIndices.fim] : "";
      const rawAbrangencia = colIndices.abrangencia !== -1 ? row[colIndices.abrangencia] : "";
      const rawFamilia = colIndices.familia !== -1 ? row[colIndices.familia] : "";
      const rawSku = colIndices.sku !== -1 ? row[colIndices.sku] : "";
      const rawFlat = colIndices.flat !== -1 ? row[colIndices.flat] : "";
      const rawAcao = colIndices.acao !== -1 ? row[colIndices.acao] : "";
      const rawInvestimento = colIndices.investimento !== -1 ? row[colIndices.investimento] : "";
      const rawVolume = colIndices.volume !== -1 ? row[colIndices.volume] : "";

      // Se todos os campos comerciais estiverem vazios, ignorar a linha sem gerar erro
      const isCommercialEmpty = (val: any) => val === undefined || val === null || String(val).trim() === "";
      if (
        isCommercialEmpty(rawTipo) &&
        isCommercialEmpty(rawPagamento) &&
        isCommercialEmpty(rawMes) &&
        isCommercialEmpty(rawInicio) &&
        isCommercialEmpty(rawFim) &&
        isCommercialEmpty(rawAbrangencia) &&
        isCommercialEmpty(rawFamilia) &&
        isCommercialEmpty(rawSku) &&
        isCommercialEmpty(rawFlat) &&
        isCommercialEmpty(rawAcao) &&
        isCommercialEmpty(rawInvestimento) &&
        isCommercialEmpty(rawVolume)
      ) {
        continue;
      }

      // Código da Matriz
      let codigoMatrizVal = cleanMatrixCode(rawCodigoMatriz);
      let redeVal = String(rawRede).trim();
      let ufVal = rawUf ? String(rawUf).trim() : "";
      let gerenteVal = rawGerente ? String(rawGerente).trim() : "";
      let canalVal = rawCanal ? String(rawCanal).trim() : "";

      if (!codigoMatrizVal) {
        rowErrors.push("Código da Matriz é obrigatório.");
        errors.push({ line: i + 1, column: "Código da Matriz", value: rawCodigoMatriz, message: "Código da Matriz é obrigatório." });
      } else {
        const cleanCode = (c: string) => c.trim().replace(/\.0$/, "");
        const matched = validMatrizes.find(m => cleanCode(m.codigo) === cleanCode(codigoMatrizVal));
        if (matched) {
          codigoMatrizVal = matched.codigo;
          redeVal = matched.nome; // Auto-preencher rede correta do banco
          ufVal = (matched as any).uf || "";
          gerenteVal = (matched as any).gerente || "";
          canalVal = (matched as any).canal || "";
        } else {
          rowErrors.push(`Código de Matriz "${codigoMatrizVal}" não encontrado.`);
          errors.push({ line: i + 1, column: "Código da Matriz", value: rawCodigoMatriz, message: `Código de Matriz "${codigoMatrizVal}" não encontrado.` });
        }
      }

      // Tipo de Ação
      let tipoVal = String(rawTipo).trim();
      if (!tipoVal) {
        rowErrors.push("Tipo de Ação é obrigatório.");
        errors.push({ line: i + 1, column: "Tipo de Ação", value: rawTipo, message: "Tipo de Ação é obrigatório." });
      } else {
        const tLower = tipoVal.toLowerCase();
        if (tLower.includes("out")) tipoVal = "Sell Out";
        else if (tLower.includes("in")) tipoVal = "Sell In";
        else {
          rowErrors.push("Tipo de Ação deve ser 'Sell Out' ou 'Sell In'.");
          errors.push({ line: i + 1, column: "Tipo de Ação", value: rawTipo, message: "Tipo de Ação inválido." });
        }
      }

      // Pagamento
      let pagamentoVal = String(rawPagamento).trim();
      if (!pagamentoVal) {
        rowErrors.push("Pagamento é obrigatório.");
        errors.push({ line: i + 1, column: "Pagamento", value: rawPagamento, message: "Pagamento é obrigatório." });
      } else {
        const pLower = pagamentoVal.toLowerCase();
        if (pLower.includes("abat") || pLower.includes("bole")) pagamentoVal = "Boleto";
        else if (pLower.includes("trans") || pLower.includes("tran")) pagamentoVal = "Transf. Bancária";
        else if (pLower.includes("boni")) pagamentoVal = "Bonificação";
        else {
          rowErrors.push("Pagamento deve ser 'Boleto', 'Transf. Bancária' ou 'Bonificação'.");
          errors.push({ line: i + 1, column: "Pagamento", value: rawPagamento, message: "Pagamento inválido." });
        }
      }

      // Mês de Referência
      let mesVal: string | null = null;
      if (!rawMes) {
        rowErrors.push("Mês de referência é obrigatório.");
        errors.push({ line: i + 1, column: "Mês de Referência", value: rawMes, message: "Mês de referência é obrigatório." });
      } else {
        if (typeof rawMes === "number") {
          const d = excelSerialToDate(rawMes);
          if (d) mesVal = d.slice(0, 7);
        } else {
          const str = String(rawMes).trim();
          const parts = str.split("/");
          if (parts.length === 2) {
            const m = parts[0].padStart(2, '0');
            const y = parts[1];
            if (y.length === 4 && !isNaN(Number(m)) && !isNaN(Number(y))) {
              mesVal = `${y}-${m}`;
            }
          } else if (str.split("-").length === 2) {
            mesVal = str;
          }
        }
        if (!mesVal) {
          rowErrors.push("Mês de referência inválido.");
          errors.push({ line: i + 1, column: "Mês de Referência", value: rawMes, message: "Mês de referência inválido (use MM/AAAA)." });
        }
      }

      // Datas
      const inicioVal = typeof rawInicio === "number" ? excelSerialToDate(rawInicio) : parseDateString(rawInicio);
      const fimVal = typeof rawFim === "number" ? excelSerialToDate(rawFim) : parseDateString(rawFim);

      if (!inicioVal) {
        rowErrors.push("Data início inválida.");
        errors.push({ line: i + 1, column: "Data Início", value: rawInicio, message: "Data início inválida." });
      }
      if (!fimVal) {
        rowErrors.push("Data fim inválida.");
        errors.push({ line: i + 1, column: "Data Fim", value: rawFim, message: "Data fim inválida." });
      }

      if (inicioVal && fimVal && inicioVal > fimVal) {
        rowErrors.push("Data início posterior à data fim.");
        errors.push({ line: i + 1, column: "Período", value: `${inicioVal} a ${fimVal}`, message: "Data início não pode ser posterior à data fim." });
      }

      // Abrangência
      let abrangenciaVal = String(rawAbrangencia).trim();
      if (!abrangenciaVal) {
        rowErrors.push("Abrangência é obrigatória.");
        errors.push({ line: i + 1, column: "Família ou SKU", value: rawAbrangencia, message: "Abrangência é obrigatória." });
      } else {
        const aLower = abrangenciaVal.toLowerCase();
        if (aLower.includes("fam")) abrangenciaVal = "Família";
        else if (aLower.includes("sku")) abrangenciaVal = "SKU";
        else {
          rowErrors.push("Abrangência inválida.");
          errors.push({ line: i + 1, column: "Família ou SKU", value: rawAbrangencia, message: "Abrangência deve ser 'Família' ou 'SKU'." });
        }
      }

      let familiaVal: string | null = null;
      let skuVal = "";

      const flatVal = parseExcelNum(rawFlat);
      const acaoVal = parseExcelNum(rawAcao);
      const investVal = parseExcelNum(rawInvestimento);
      const volVal = parseExcelNum(rawVolume);

      if (flatVal !== null && flatVal < 0) {
        rowErrors.push("Preço Flat não pode ser negativo.");
        errors.push({ line: i + 1, column: "Preço Flat", value: rawFlat, message: "Preço Flat não pode ser negativo." });
      }
      if (acaoVal !== null && acaoVal < 0) {
        rowErrors.push("Preço da Ação não pode ser negativo.");
        errors.push({ line: i + 1, column: "Preço da Ação", value: rawAcao, message: "Preço da Ação não pode ser negativo." });
      }
      if (flatVal !== null && acaoVal !== null && acaoVal > flatVal) {
        rowErrors.push("Preço da Ação não pode ser maior que Preço Flat.");
        errors.push({ line: i + 1, column: "Valores", value: `Flat: ${flatVal}, Ação: ${acaoVal}`, message: "Preço da Ação maior que Flat." });
      }

      if (abrangenciaVal === "Família") {
        familiaVal = String(rawFamilia).trim();
        if (!familiaVal) {
          rowErrors.push("Família é obrigatória.");
          errors.push({ line: i + 1, column: "Família de Produto", value: rawFamilia, message: "Família é obrigatória." });
        } else {
          const match = validFams.find(vf => vf.toLowerCase() === familiaVal!.toLowerCase());
          if (match) {
            familiaVal = match;
          } else {
            rowErrors.push(`Família "${familiaVal}" inválida.`);
            errors.push({ line: i + 1, column: "Família de Produto", value: rawFamilia, message: `Família "${familiaVal}" inválida (valores aceitos: ${PRODUCT_FAMILIES.join(", ")}).` });
          }
        }
        if (investVal === null || investVal <= 0) {
          rowErrors.push("Investimento é obrigatório.");
          errors.push({ line: i + 1, column: "Investimento", value: rawInvestimento, message: "Investimento deve ser maior que zero." });
        }
        if (volVal === null || volVal <= 0) {
          rowErrors.push("Volume é obrigatório.");
          errors.push({ line: i + 1, column: "Expectativa de Volume", value: rawVolume, message: "Volume deve ser maior que zero." });
        }
      } else if (abrangenciaVal === "SKU") {
        skuVal = String(rawSku).trim();
        if (!skuVal) {
          rowErrors.push("SKU é obrigatório.");
          errors.push({ line: i + 1, column: "SKU", value: rawSku, message: "SKU é obrigatório." });
        } else {
          const match = validSkus.find((vs: any) => vs.toLowerCase() === skuVal.toLowerCase());
          if (match) {
            skuVal = match;
          } else {
            rowErrors.push(`SKU "${skuVal}" não cadastrado.`);
            errors.push({ line: i + 1, column: "SKU", value: rawSku, message: `SKU "${skuVal}" não cadastrado.` });
          }
        }
        if (investVal === null || investVal <= 0) {
          rowErrors.push("Investimento é obrigatório.");
          errors.push({ line: i + 1, column: "Investimento", value: rawInvestimento, message: "Investimento deve ser maior que zero." });
        }
        if (volVal === null || volVal <= 0) {
          rowErrors.push("Volume é obrigatório.");
          errors.push({ line: i + 1, column: "Expectativa de Volume", value: rawVolume, message: "Volume deve ser maior que zero." });
        }
      }

      parsedLines.push({
        lineIndex: i + 1,
        data: {
          rede: redeVal,
          codigo_matriz: codigoMatrizVal,
          uf: ufVal,
          gerente: gerenteVal,
          canal: canalVal,
          tipo_acao: tipoVal,
          tipo_pagamento: pagamentoVal,
          mes_referencia: mesVal || "",
          data_inicio: inicioVal || "",
          data_fim: fimVal || "",
          abrangencia: abrangenciaVal,
          familia_produto: familiaVal,
          sku: skuVal,
          preco_flat: flatVal,
          preco_acao: acaoVal,
          valor_investimento: investVal,
          expectativa_volume: volVal
        },
        valid: rowErrors.length === 0,
        errors: rowErrors
      });
    }

    const totalRows = parsedLines.length;
    const validLines = parsedLines.filter(l => l.valid);
    const totalInvestment = validLines.reduce((acc, curr) => acc + (curr.data.valor_investimento || 0), 0);
    const totalVolume = validLines.reduce((acc, curr) => acc + (curr.data.expectativa_volume || 0), 0);

    return successResult({
      errors,
      summary: {
        totalRows,
        validRows: validLines.length,
        invalidRows: errors.length,
        totalInvestment,
        totalVolume
      },
      parsedLines
    });
  } catch (error: any) {
    handleActionError(error, {
      module: "Investimentos",
      action: "simularImportacaoInvestimentos"
    });
  }
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

        // Configurar destinatários via serviço por responsabilidade funcional
        const resolvedRecipients = await resolveNotificationRecipients({
          evento: "ACAO_NAO_OCORREU",
          faseAtual: 1,
          gerenteEmail: managerEmail
        });
        const recipients = resolvedRecipients.recipientsString;

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

export async function obterPlanilhaModelo(isPlanejamento: boolean = false, filterRede?: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Obter perfil e papel do usuário
    const { data: profile } = await supabase
      .from("cm_user_profiles")
      .select("role")
      .eq("id", user?.id || "")
      .single();

    const userRole = profile?.role || null;
    const userEmail = user?.email || null;

    // 2. Buscar matrizes
    const { data: matrizes, error: mError } = await supabase
      .from("v_redes_matrizes_detalhes")
      .select("*")
      .order("nome", { ascending: true });

    if (mError) throw mError;

    // 3. Buscar SKUs (produtos)
    const { data: dbFilters } = await supabase.rpc("get_dashboard_filters_rpc");
    const activeSkus = dbFilters?.produtos || [];

    // 4. Filtrar matrizes conforme o perfil
    let targetMatrizes = [...(matrizes || [])];

    if ((userRole === "Gerente Regional" || userRole === "Gerente Nacional") && userEmail) {
      const emailPrefix = userEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      targetMatrizes = targetMatrizes.filter(m => {
        if (!m.gerente) return false;
        const cleanGerente = m.gerente.toLowerCase().replace(/[^a-z0-9]/g, "");
        return emailPrefix.startsWith(cleanGerente) || cleanGerente.startsWith(emailPrefix);
      });
    }

    // Filtrar por Rede caso o filtro de tela esteja ativo
    if (filterRede) {
      targetMatrizes = targetMatrizes.filter(m => m.nome?.toLowerCase() === filterRede.toLowerCase());
    }

    // 5. Instanciar ExcelJS Workbook
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();

    // 5.1 Aba: Instruções (Primeira Aba)
    const instructionsSheet = workbook.addWorksheet("Instruções");
    instructionsSheet.views = [{ showGridLines: false }];
    
    // Título das Instruções
    instructionsSheet.getCell("A1").value = "Coffee Mais - Planejador de Investimentos Comerciais";
    instructionsSheet.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "1F4E78" } };
    
    instructionsSheet.getCell("A3").value = "Instruções de Preenchimento da Planilha Modelo";
    instructionsSheet.getCell("A3").font = { name: "Arial", size: 12, bold: true, color: { argb: "333333" } };
    
    const steps = [
      "1. A planilha já vem pré-preenchida nas colunas cinzas (A a E) com as redes e códigos de matriz da sua carteira.",
      "2. NÃO altere as colunas cinzas (Código, Rede, UF, Gerente e Canal), pois elas estão protegidas e são utilizadas apenas para conferência.",
      "3. Preencha os dados da ação comercial apenas nas colunas amarelas (F a Q) para as lojas/redes que receberão as ações comerciais.",
      "4. Utilize os seletores (dropdowns/listas suspensas) nas colunas de Tipo de Ação, Pagamento, Mês, Abrangência, Família e SKU para evitar erros de digitação.",
      "5. Deixe em branco (sem preenchimento comercial) os clientes que não possuírem ações comerciais no período. Essas linhas serão ignoradas automaticamente durante a simulação.",
      "6. Salve o arquivo e faça o upload no modal do sistema para simular os indicadores e concluir a gravação transacional."
    ];

    steps.forEach((step, idx) => {
      const cell = instructionsSheet.getCell(`A${5 + idx}`);
      cell.value = step;
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { wrapText: true };
    });
    instructionsSheet.getColumn(1).width = 130;

    // 5.2 Aba Principal: Modelo
    const mainSheet = workbook.addWorksheet(isPlanejamento ? "Modelo Planejamento" : "Modelo Investimentos");
    mainSheet.views = [{ state: "frozen", ySplit: 1, showGridLines: true }];

    // 5.3 Aba Oculta: Validação
    const listsSheet = workbook.addWorksheet("Listas_Validação");
    listsSheet.state = "veryHidden";

    // 6. Preencher dados da aba auxiliar (oculta)
    // Coluna A: Mês de Referência (próximos 12 meses)
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      months.push(`${mm}/${yyyy}`);
    }
    months.forEach((val, idx) => {
      listsSheet.getCell(`A${idx + 1}`).value = val;
    });

    // Coluna B: SKUs ativos do banco
    activeSkus.forEach((val: string, idx: number) => {
      listsSheet.getCell(`B${idx + 1}`).value = val;
    });

    // Coluna C: Família de Produto
    const familias = [...PRODUCT_FAMILIES];
    familias.forEach((val, idx) => {
      listsSheet.getCell(`C${idx + 1}`).value = val;
    });

    // Coluna D: Tipo de Ação
    const tipos = ["Sell Out", "Sell In"];
    tipos.forEach((val, idx) => {
      listsSheet.getCell(`D${idx + 1}`).value = val;
    });

    // Coluna E: Pagamento
    const pagamentos = ["Boleto", "Transf. Bancária", "Bonificação"];
    pagamentos.forEach((val, idx) => {
      listsSheet.getCell(`E${idx + 1}`).value = val;
    });

    // Coluna F: Família ou SKU
    const abrangencias = ["Família", "SKU"];
    abrangencias.forEach((val, idx) => {
      listsSheet.getCell(`F${idx + 1}`).value = val;
    });

    // 7. Definir cabeçalhos e largura das colunas
    mainSheet.columns = [
      { header: "Código da Matriz", key: "codigo", width: 18 },
      { header: "Rede", key: "rede", width: 20 },
      { header: "UF", key: "uf", width: 8 },
      { header: "Gerente", key: "gerente", width: 15 },
      { header: "Canal", key: "canal", width: 12 },
      { header: "Tipo de Ação", key: "tipo", width: 15 },
      { header: "Pagamento", key: "pagamento", width: 15 },
      { header: "Mês de Referência", key: "mes", width: 18 },
      { header: "Data Início", key: "inicio", width: 15 },
      { header: "Data Fim", key: "fim", width: 15 },
      { header: "Família ou SKU", key: "abrangencia", width: 15 },
      { header: "Família de Produto", key: "familia", width: 18 },
      { header: "SKU", key: "sku", width: 25 },
      { header: "Preço Flat", key: "flat", width: 12 },
      { header: "Preço da Ação", key: "acao", width: 12 },
      { header: "Investimento", key: "investimento", width: 12 },
      { header: "Expectativa de Volume", key: "volume", width: 20 }
    ];

    // Estilizar cabeçalho (Linha 1)
    const headerRow = mainSheet.getRow(1);
    headerRow.height = 30;
    headerRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

    // Estilo dos cabeçalhos: Informativos (Cinza Escuro) e Comerciais (Azul Escuro / Aço)
    for (let c = 1; c <= 5; c++) {
      headerRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "595959" }
      };
    }
    for (let c = 6; c <= 17; c++) {
      headerRow.getCell(c).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1F4E78" }
      };
    }

    // Inserir Notas explicativas (Comments) nos cabeçalhos F a Q
    mainSheet.getCell("F1").note = "Tipo da ação comercial: Selecione 'Sell Out' ou 'Sell In'.";
    mainSheet.getCell("G1").note = "Forma de pagamento: Selecione 'Boleto', 'Transf. Bancária' ou 'Bonificação'.";
    mainSheet.getCell("H1").note = "Mês de referência: Selecione no formato MM/AAAA da lista.";
    mainSheet.getCell("I1").note = "Data de início da ação no formato DD/MM/AAAA.";
    mainSheet.getCell("J1").note = "Data de término da ação no formato DD/MM/AAAA.";
    mainSheet.getCell("K1").note = "Selecione 'Família' para focar em grupos de produtos ou 'SKU' para produtos específicos.";
    mainSheet.getCell("L1").note = "Selecione a Família de Produto se a abrangência for 'Família'.";
    mainSheet.getCell("M1").note = "Selecione o SKU específico se a abrangência for 'SKU'.";
    mainSheet.getCell("N1").note = "Preço regular sugerido (Flat Price) - Opcional.";
    mainSheet.getCell("O1").note = "Preço com desconto na ação (Preço da Ação) - Opcional.";
    mainSheet.getCell("P1").note = "Valor em reais (R$) do investimento total para este cliente (Obrigatório).";
    mainSheet.getCell("Q1").note = "Expectativa de volume físico vendido na ação em Kg/Unidades (Obrigatório).";

    // 8. Inserir linhas das matrizes autorizadas com estilos de preenchimento e proteção
    const grayFill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    const yellowFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2CC" } };
    const borderStyle = {
      top: { style: "thin", color: { argb: "D9D9D9" } },
      left: { style: "thin", color: { argb: "D9D9D9" } },
      bottom: { style: "thin", color: { argb: "D9D9D9" } },
      right: { style: "thin", color: { argb: "D9D9D9" } }
    };

    const addStyledRow = (codigo: string, rede: string, uf: string, gerente: string, canal: string) => {
      const addedRow = mainSheet.addRow([codigo, rede, uf, gerente, canal, "", "", "", "", "", "", "", "", "", "", "", ""]);
      addedRow.height = 20;

      // Colunas A a E (Informativas, Cinza, Bloqueadas)
      for (let c = 1; c <= 5; c++) {
        const cell = addedRow.getCell(c);
        cell.fill = grayFill;
        cell.protection = { locked: true };
        cell.border = borderStyle;
        cell.font = { name: "Arial", size: 9 };
      }
      // Colunas F a Q (Comerciais, Amarelo Claro, Desbloqueadas)
      for (let c = 6; c <= 17; c++) {
        const cell = addedRow.getCell(c);
        cell.fill = yellowFill;
        cell.protection = { locked: false };
        cell.border = borderStyle;
        cell.font = { name: "Arial", size: 9 };
      }
    };

    if (targetMatrizes.length > 0) {
      targetMatrizes.forEach(m => {
        addStyledRow(m.codigo, m.nome || "", m.uf || "", m.gerente || "", m.canal || "");
      });
    } else {
      addStyledRow("146775.0", "BISTEK", "SC", "Leandro", "KA");
    }

    const rowCount = Math.max(targetMatrizes.length + 1, 100);

    // 9. Aplicar as Data Validations de colunas F a M
    for (let r = 2; r <= rowCount; r++) {
      // Column F (Tipo de Ação) -> ListsSheet D
      mainSheet.getCell(`F${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["Listas_Validação!$D$1:$D$2"]
      };
      // Column G (Pagamento) -> ListsSheet E
      mainSheet.getCell(`G${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["Listas_Validação!$E$1:$E$3"]
      };
      // Column H (Mês de Referência) -> ListsSheet A
      mainSheet.getCell(`H${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["Listas_Validação!$A$1:$A$12"]
      };
      // Column K (Família ou SKU) -> ListsSheet F
      mainSheet.getCell(`K${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["Listas_Validação!$F$1:$F$2"]
      };
      // Column L (Família de Produto) -> ListsSheet C
      mainSheet.getCell(`L${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["Listas_Validação!$C$1:$C$5"]
      };
      // Column M (SKU) -> ListsSheet B
      mainSheet.getCell(`M${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`Listas_Validação!$B$1:$B$${activeSkus.length || 1}`]
      };
    }

    // Ativar proteção da planilha e auto-filtro
    mainSheet.autoFilter = `A1:Q${rowCount}`;
    mainSheet.protect("coffemais_lock_sheets", {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: true,
      autoFilter: true
    });

    // 10. Converter para Buffer e retornar base64
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().split("T")[0];
    const finalFileName = isPlanejamento 
      ? `modelo_planejamento_investimentos_${dateStr}.xlsx` 
      : `modelo_lancamento_investimentos_${dateStr}.xlsx`;

    return {
      success: true,
      data: Buffer.from(buffer).toString("base64"),
      fileName: finalFileName
    };

  } catch (err: any) {
    console.error("Erro ao gerar planilha inteligente:", err);
    return { success: false, error: err.message };
  }
}

export interface HistoricoItemConsultor {
  id: string;
  data: string;
  investimento: number;
  preco_flat: number;
  preco_acao: number;
  expectativa_volume: number;
  custo_unidade: number;
  eficiencia_comercial: number;
  roi_estimado: number;
}

export interface HistoricoItemConsultor {
  id: string;
  data: string;
  data_day?: string;
  investimento: number;
  preco_flat: number;
  preco_acao: number;
  expectativa_volume: number;
  custo_unidade: number;
  eficiencia_comercial: number;
  roi_estimado: number;
}

export interface ResultadoConsultorComercial {
  hasHistory: boolean;
  message?: string;
  count: number;
  actions: HistoricoItemConsultor[];
  lastAction: HistoricoItemConsultor | null;
}

export async function obterHistoricoConsultorComercial(params: {
  codigo_matriz?: string;
  rede?: string;
  uf?: string;
  gerente?: string;
  abrangencia: "Família" | "SKU";
  itemNome: string;
  tipo_pagamento?: string;
  tipo_acao_detalhe?: string;
  mes_referencia_anterior?: string;
}): Promise<ResultadoConsultorComercial> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("cm_acoes_investimento")
      .select("id, created_at, data_inicio, mes_referencia, abrangencia, familia_produto, familias_detalhes, skus_detalhes, valor_investimento, expectativa_volume, preco_flat, preco_acao, tipo_pagamento, tipo_acao, tipo_acao_detalhe, fase_atual, is_planejamento")
      .gte("fase_atual", 1)
      .order("created_at", { ascending: false })
      .limit(100);

    if (params.codigo_matriz) {
      const cleanCode = cleanMatrixCode(params.codigo_matriz);
      query = query.or(`codigo_matriz.eq.${cleanCode},codigo_matriz.eq.${cleanCode}.0,codigo_matriz.eq.${params.codigo_matriz}`);
    } else if (params.rede) {
      query = query.ilike("rede", `%${params.rede}%`);
    }

    const { data: rawActions, error } = await query;

    if (error || !rawActions || rawActions.length === 0) {
      return {
        hasHistory: false,
        message: "Primeiro lançamento equivalente para esta combinação.",
        count: 0,
        actions: [],
        lastAction: null
      };
    }

    const matched: HistoricoItemConsultor[] = [];

    for (const pa of rawActions) {
      if (pa.is_planejamento) continue;

      if (params.mes_referencia_anterior) {
        const actionMonth = pa.mes_referencia || (pa.data_inicio ? pa.data_inicio.slice(0, 7) : null);
        if (actionMonth !== params.mes_referencia_anterior) {
          continue;
        }
      }

      if (params.tipo_pagamento && pa.tipo_pagamento && pa.tipo_pagamento.toLowerCase() !== params.tipo_pagamento.toLowerCase()) {
        continue;
      }
      if (params.tipo_acao_detalhe && (pa.tipo_acao_detalhe || pa.tipo_acao)) {
        const detail = pa.tipo_acao_detalhe || pa.tipo_acao || "";
        if (detail.toLowerCase() !== params.tipo_acao_detalhe.toLowerCase()) {
          continue;
        }
      }

      let inv = 0;
      let flat = 0;
      let acao = 0;
      let vol = 0;
      let foundItem = false;

      const targetDetails = params.abrangencia === "Família" ? pa.familias_detalhes : pa.skus_detalhes;
      if (Array.isArray(targetDetails)) {
        for (const d of targetDetails) {
          const detailLabel = params.abrangencia === "Família" ? (d.familia_nome || d.familia) : d.sku;
          if (detailLabel && detailLabel.toLowerCase().trim() === params.itemNome.toLowerCase().trim()) {
            inv = Number(d.investimento) || 0;
            flat = Number(d.preco_flat) || 0;
            acao = Number(d.preco_acao) || 0;
            vol = Number(d.expectativa_volume) || 0;
            foundItem = true;
            break;
          }
        }
      }

      if (!foundItem) {
        if (params.abrangencia === "Família" && pa.familia_produto?.toLowerCase() === params.itemNome.toLowerCase()) {
          inv = Number(pa.valor_investimento) || 0;
          flat = Number(pa.preco_flat) || 0;
          acao = Number(pa.preco_acao) || 0;
          vol = Number(pa.expectativa_volume) || 0;
          foundItem = true;
        }
      }

      if (foundItem && inv > 0 && vol > 0) {
        const dateObj = new Date(pa.data_inicio || pa.created_at || Date.now());
        const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const day = dateObj.getDate().toString().padStart(2, "0");
        const monthNum = (dateObj.getMonth() + 1).toString().padStart(2, "0");
        const monthName = months[dateObj.getMonth()].toUpperCase();
        const year = dateObj.getFullYear();

        const baseLabel = `${monthName}/${year}`;
        const dayLabel = `${monthsShort[dateObj.getMonth()]}/${year.toString().slice(2)} (${day}/${monthNum})`;

        const custo_unidade = inv / vol;
        const eficiencia_comercial = vol / inv;
        const roi_estimado = acao > 0 ? (acao * vol) / inv : 0;

        matched.push({
          id: pa.id,
          data: baseLabel,
          data_day: dayLabel,
          investimento: inv,
          preco_flat: flat,
          preco_acao: acao,
          expectativa_volume: vol,
          custo_unidade,
          eficiencia_comercial,
          roi_estimado
        });
      }
    }

    if (matched.length === 0) {
      return {
        hasHistory: false,
        message: "Primeiro lançamento equivalente para esta combinação.",
        count: 0,
        actions: [],
        lastAction: null
      };
    }

    const rawTop3 = matched.slice(0, 3);
    const monthCounts: Record<string, number> = {};
    rawTop3.forEach(x => {
      monthCounts[x.data] = (monthCounts[x.data] || 0) + 1;
    });

    const top3 = rawTop3.map(x => {
      if (monthCounts[x.data] > 1 && x.data_day) {
        return { ...x, data: x.data_day };
      }
      return x;
    });

    const lastAction = top3[0]; // Real most recent equivalent launch (Priority 1)

    return {
      hasHistory: true,
      count: matched.length,
      actions: top3,
      lastAction
    };
  } catch (err: any) {
    console.error("Erro ao obter histórico do consultor comercial:", err);
    return {
      hasHistory: false,
      message: "Não foi possível carregar o histórico para comparação.",
      count: 0,
      actions: [],
      lastAction: null
    };
  }
}



