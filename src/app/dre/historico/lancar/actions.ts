"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DRE_LINHAS, DRESalvarInput, DREHistoricoRow } from "../constants";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && !isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && !isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

// ─── SALVAR DRE Histórico ────────────────────────────────────────────────────

export async function salvarDREHistorico(input: DRESalvarInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado.");

  const { ano, mes, cenario, gerente_id, items } = input;

  // 1. Upsert header
  const { data: header, error: headerError } = await supabase
    .from("cm_dre_historico")
    .upsert(
      {
        ano,
        mes,
        cenario,
        gerente_id: gerente_id || null,
        uploaded_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ano,mes,cenario,gerente_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (headerError || !header) {
    console.error("Erro ao salvar header DRE:", headerError);
    throw new Error("Falha ao salvar cabeçalho do DRE.");
  }

  // 2. Deletar items antigos
  const { error: deleteError } = await supabase
    .from("cm_dre_historico_items")
    .delete()
    .eq("header_id", header.id);

  if (deleteError) throw new Error("Falha ao atualizar itens do DRE.");

  // 3. Inserir novos items
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("cm_dre_historico_items")
      .insert(
        items.map((item) => ({
          header_id: header.id,
          linha_codigo: item.linha_codigo,
          linha_nome: item.linha_nome,
          valor: item.valor,
          ordem: item.ordem,
        }))
      );

    if (itemsError) throw new Error("Falha ao salvar linhas do DRE.");
  }

  revalidatePath("/dre/historico");
  revalidatePath("/dre");
  return { success: true, header_id: header.id };
}

// ─── BUSCAR DRE Histórico ─────────────────────────────────────────────────────

export async function buscarDREHistorico({
  ano,
  cenario = "REAL",
  gerente_id,
}: {
  ano: number;
  cenario?: "REAL" | "BUDGET" | "FORECAST";
  gerente_id?: string | null;
}): Promise<DREHistoricoRow[]> {
  const supabase = await createClient();
  const anoAnterior = ano - 1;

  let query = supabase
    .from("cm_dre_historico")
    .select(`
      id, ano, mes, cenario, gerente_id,
      cm_dre_historico_items ( linha_codigo, linha_nome, valor, ordem )
    `)
    .eq("cenario", cenario)
    .or(`ano.eq.${ano},ano.eq.${anoAnterior}`)
    .order("ano", { ascending: true })
    .order("mes", { ascending: true });

  if (gerente_id) {
    query = query.eq("gerente_id", gerente_id);
  } else {
    query = query.is("gerente_id", null);
  }

  const { data: headers, error } = await query;
  if (error || !headers || headers.length === 0) return [];

  // Mapa: "2025-3" → { receita_bruta: 1000, ... }
  const dataMap = new Map<string, Record<string, number | null>>();
  for (const h of headers) {
    const key = `${h.ano}-${h.mes}`;
    const map: Record<string, number | null> = {};
    for (const item of (h.cm_dre_historico_items as any[])) {
      map[item.linha_codigo] = item.valor;
    }
    dataMap.set(key, map);
  }

  return DRE_LINHAS.map((linha) => {
    const meses: (number | null)[] = Array.from({ length: 12 }, (_, i) =>
      dataMap.get(`${ano}-${i + 1}`)?.[linha.codigo] ?? null
    );

    const acum = linha.isUnit ? avg(meses) : sum(meses);

    const allMonths: (number | null)[] = [
      ...Array.from({ length: 12 }, (_, i) => dataMap.get(`${anoAnterior}-${i + 1}`)?.[linha.codigo] ?? null),
      ...meses,
    ];
    const withData = allMonths.filter((v) => v !== null) as number[];

    return {
      linha_codigo:  linha.codigo,
      linha_nome:    linha.nome,
      ordem:         linha.ordem,
      isBold:        linha.isBold,
      isHighlight:   linha.isHighlight,
      isUnit:        linha.isUnit,
      isPercent:     ("isPercent" in linha ? linha.isPercent : false) ?? false,
      meses,
      acum,
      media3m:   avg(withData.slice(-3)),
      rolling6m: avg(withData.slice(-6)),
      media12m:  avg(withData.slice(-12)),
    };
  });
}

// ─── DELETAR DRE Histórico ────────────────────────────────────────────────────

export async function deletarDREHistorico({
  ano, mes, cenario, gerente_id,
}: {
  ano: number;
  mes: number;
  cenario: "REAL" | "BUDGET" | "FORECAST";
  gerente_id: string | null;
}) {
  const supabase = await createClient();

  let q = supabase.from("cm_dre_historico").delete()
    .eq("ano", ano).eq("mes", mes).eq("cenario", cenario);

  q = gerente_id ? q.eq("gerente_id", gerente_id) : q.is("gerente_id", null);

  const { error } = await q;
  if (error) throw new Error("Falha ao remover lançamento.");

  revalidatePath("/dre/historico");
  return { success: true };
}

// ─── LISTAR Gerentes ──────────────────────────────────────────────────────────

export async function listarGerentesParaDRE() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cm_user_profiles")
    .select("id, name, role")
    .in("role", ["admin", "gerente", "gestor"])
    .order("name");
  if (error) return [];
  return data ?? [];
}

// ─── BUSCAR Anos disponíveis ──────────────────────────────────────────────────

export async function buscarAnosDisponiveis(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cm_dre_historico")
    .select("ano")
    .order("ano", { ascending: false });

  if (error || !data) return [new Date().getFullYear()];
  const anos = [...new Set(data.map((d) => d.ano))] as number[];
  if (!anos.includes(new Date().getFullYear())) anos.unshift(new Date().getFullYear());
  return anos;
}

// ─── IMPORTAR Excel DRE (Fase 2) ──────────────────────────────────────────────

export async function importarExcelDRE({
  ano,
  mes,
  filename,
  rawRows,
  normalizedRows,
}: {
  ano: number;
  mes: number;
  filename: string;
  rawRows: any[];
  normalizedRows: any[];
}) {
  const startedAt = new Date();
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  // 1. Criar o log de importação com status 'uploaded'
  const { data: log, error: logError } = await supabase
    .from("cm_dre_import_logs")
    .insert({
      filename,
      source: "excel",
      status: "uploaded",
      started_at: startedAt.toISOString(),
      imported_by: user.id,
    })
    .select("id")
    .single();

  if (logError || !log) {
    console.error("Erro ao criar log de importação:", logError);
    throw new Error("Falha ao registrar log de importação.");
  }

  const logId = log.id;

  try {
    // 2. Mudar status para 'parsing' (gravando staging)
    await supabase
      .from("cm_dre_import_logs")
      .update({ status: "parsing" })
      .eq("id", logId);

    // Gravar as linhas originais na staging cm_dre_excel_raw em lotes de 100
    const rawInserts = rawRows.map((row, idx) => ({
      import_log_id: logId,
      row_number: idx + 1,
      raw_data: row,
      imported_by: user.id,
      imported_at: new Date().toISOString(),
    }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < rawInserts.length; i += CHUNK_SIZE) {
      const chunk = rawInserts.slice(i, i + CHUNK_SIZE);
      const { error: rawError } = await supabase
        .from("cm_dre_excel_raw")
        .insert(chunk);

      if (rawError) {
        console.error("Erro ao gravar staging:", rawError);
        throw new Error(`Falha ao gravar staging na linha ${i + 1}: ${rawError.message}`);
      }
    }

    // 3. Mudar status para 'normalizing'
    await supabase
      .from("cm_dre_import_logs")
      .update({ status: "normalizing" })
      .eq("id", logId);

    // 4. Executar normalização e versionamento no banco através do RPC
    const { data: syncResult, error: syncError } = await supabase.rpc("import_dre_excel_data", {
      p_ano: ano,
      p_mes: mes,
      p_import_log_id: logId,
      p_uploaded_by: user.id,
      p_rows: normalizedRows,
    });

    if (syncError) {
      console.error("Erro na stored procedure import_dre_excel_data:", syncError);
      throw new Error(`Erro na consolidação DRE: ${syncError.message}`);
    }

    // 5. Finalizar log com sucesso
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await supabase
      .from("cm_dre_import_logs")
      .update({
        status: "success",
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        rows_imported: syncResult?.processed || 0,
      })
      .eq("id", logId);

    revalidatePath("/dre/historico");
    revalidatePath("/dre");

    return {
      success: true,
      logId,
      processed: syncResult?.processed || 0,
      inserted: syncResult?.inserted || 0,
      updated: syncResult?.updated || 0,
      durationMs,
    };

  } catch (error: any) {
    console.error("Erro durante importação Excel DRE:", error);
    
    // Atualizar log para 'error'
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    
    await supabase
      .from("cm_dre_import_logs")
      .update({
        status: "error",
        finished_at: finishedAt.toISOString(),
        duration_ms: durationMs,
        error_log: error.message || String(error),
      })
      .eq("id", logId);

    throw error;
  }
}

// ─── FECHAMENTO E AUDITORIA DRE (Fase 3) ──────────────────────────────────────

export async function fecharMesDRE({
  ano,
  mes,
  notes,
}: {
  ano: number;
  mes: number;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  // 1. Consultar todos os registros ativos da competência
  const { data: activeRows, error: fetchError } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes)
    .eq("is_active", true)
    .eq("is_deleted", false);

  if (fetchError) {
    console.error("Erro ao buscar registros ativos para fechamento:", fetchError);
    throw new Error("Falha ao recuperar dados da competência.");
  }

  // 2. Calcular agregados estruturados para o snapshot
  const resumoGeral = {
    volume: 0,
    receita_bruta: 0,
    impostos: 0,
    investimento_comercial: 0,
    receita_liquida: 0,
    custo_produtos: 0,
    frete: 0,
    margem_contribuicao: 0,
    dga: 0,
    custo_rede: 0,
    ebitda: 0,
  };

  const porGerente: Record<string, typeof resumoGeral> = {};
  const porRede: Record<string, typeof resumoGeral> = {};

  activeRows?.forEach((row) => {
    // Totais gerais
    resumoGeral.volume += Number(row.volume) || 0;
    resumoGeral.receita_bruta += Number(row.receita_bruta) || 0;
    resumoGeral.impostos += Number(row.impostos) || 0;
    resumoGeral.investimento_comercial += Number(row.investimento_comercial) || 0;
    resumoGeral.receita_liquida += Number(row.receita_liquida) || 0;
    resumoGeral.custo_produtos += Number(row.custo_produtos) || 0;
    resumoGeral.frete += Number(row.frete) || 0;
    resumoGeral.margem_contribuicao += Number(row.margem_contribuicao) || 0;
    resumoGeral.dga += Number(row.dga) || 0;
    resumoGeral.custo_rede += Number(row.custo_rede) || 0;
    resumoGeral.ebitda += Number(row.ebitda) || 0;

    // Agrupamento por Gerente
    const gId = row.gerente_id || "ALL";
    if (!porGerente[gId]) {
      porGerente[gId] = { ...resumoGeral };
      Object.keys(porGerente[gId]).forEach(k => (porGerente[gId] as any)[k] = 0);
    }
    porGerente[gId].volume += Number(row.volume) || 0;
    porGerente[gId].receita_bruta += Number(row.receita_bruta) || 0;
    porGerente[gId].ebitda += Number(row.ebitda) || 0;

    // Agrupamento por Rede
    const rId = row.codigo_matriz || "ALL";
    if (!porRede[rId]) {
      porRede[rId] = { ...resumoGeral };
      Object.keys(porRede[rId]).forEach(k => (porRede[rId] as any)[k] = 0);
    }
    porRede[rId].volume += Number(row.volume) || 0;
    porRede[rId].receita_bruta += Number(row.receita_bruta) || 0;
    porRede[rId].ebitda += Number(row.ebitda) || 0;
  });

  const snapshotJson = {
    resumo_geral: resumoGeral,
    por_gerente: porGerente,
    por_rede: porRede,
    totais_auxiliares: {
      preco_medio_kg: resumoGeral.volume > 0 ? (resumoGeral.receita_bruta) / (resumoGeral.volume) : 0,
      percentual_imposto: resumoGeral.receita_bruta > 0 ? (resumoGeral.impostos / resumoGeral.receita_bruta) * 100 : 0,
      percentual_investimento: resumoGeral.receita_bruta > 0 ? (resumoGeral.investimento_comercial / resumoGeral.receita_bruta) * 100 : 0,
    }
  };

  // 3. Gerar Checksum MD5 do snapshot para auditoria de integridade
  const snapshotChecksum = crypto
    .createHash("md5")
    .update(JSON.stringify(snapshotJson))
    .digest("hex");

  // 4. Executar o fechamento oficial via RPC (com Lock preventivo)
  const { error: rpcError } = await supabase.rpc("close_dre_month", {
    p_ano: ano,
    p_mes: mes,
    p_closed_by: user.id,
    p_notes: notes || null,
    p_snapshot_json: snapshotJson,
    p_snapshot_checksum: snapshotChecksum,
  });

  if (rpcError) {
    console.error("Erro no fechamento oficial:", rpcError);
    throw new Error(`Falha no fechamento do período: ${rpcError.message}`);
  }

  // 5. Avaliar alertas do mês fechado
  await avaliarAlertasDRE({ ano, mes });

  revalidatePath("/dre/historico");
  revalidatePath("/dre");

  return { success: true, checksum: snapshotChecksum };
}

export async function reabrirMesDRE({
  ano,
  mes,
  reason,
}: {
  ano: number;
  mes: number;
  reason: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  // Verificar se o usuário possui cargo autorizado (Admin/CEO/Diretor)
  const { data: profile, error: profError } = await supabase
    .from("cm_user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profError || !profile) {
    throw new Error("Perfil de usuário não encontrado.");
  }

  const role = String(profile.role).toLowerCase();
  if (!["admin", "ceo", "diretor", "gestor"].includes(role)) {
    throw new Error("Permissão insuficiente para reabrir períodos.");
  }

  // Reabrir o período utilizando stored procedure
  const { error: rpcError } = await supabase.rpc("reopen_dre_month", {
    p_ano: ano,
    p_mes: mes,
    p_reopened_by: user.id,
    p_reopen_reason: reason,
  });

  if (rpcError) {
    console.error("Erro na reabertura do mês:", rpcError);
    throw new Error(`Falha ao reabrir período: ${rpcError.message}`);
  }

  revalidatePath("/dre/historico");
  revalidatePath("/dre");

  return { success: true };
}

// ─── MOTOR DE ALERTAS DRE (Fase 3) ───────────────────────────────────────────

export async function avaliarAlertasDRE({
  ano,
  mes,
}: {
  ano: number;
  mes: number;
}) {
  const supabase = await createClient();
  
  // 1. Obter registros ativos do período
  const { data: currentRows } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", ano)
    .eq("mes", mes)
    .eq("is_active", true)
    .eq("is_deleted", false);

  if (!currentRows || currentRows.length === 0) return [];

  // Obter registros da competência anterior para verificação de queda de receita
  const prevAno = mes === 1 ? ano - 1 : ano;
  const prevMes = mes === 1 ? 12 : mes - 1;

  const { data: prevRows } = await supabase
    .from("cm_dre_financeiro")
    .select("*")
    .eq("ano", prevAno)
    .eq("mes", prevMes)
    .eq("is_active", true)
    .eq("is_deleted", false);

  const prevMap = new Map<string, number>();
  prevRows?.forEach((row) => {
    const key = `${row.codigo_matriz}_${row.gerente_id}`;
    prevMap.set(key, (prevMap.get(key) || 0) + (Number(row.receita_bruta) || 0));
  });

  // Agrupado do mês corrente
  const currentMap = new Map<string, number>();
  currentRows.forEach((row) => {
    const key = `${row.codigo_matriz}_${row.gerente_id}`;
    currentMap.set(key, (currentMap.get(key) || 0) + (Number(row.receita_bruta) || 0));
  });

  const alertsToUpsert: any[] = [];

  // A. Queda de Receita > 20%
  currentMap.forEach((rec, key) => {
    const prevRec = prevMap.get(key) || 0;
    if (prevRec > 0) {
      const dropPct = ((prevRec - rec) / prevRec) * 100;
      if (dropPct > 20) {
        const [codigoMatriz] = key.split("_");
        const alertHash = crypto
          .createHash("md5")
          .update(`${ano}_${mes}_RECEITA_QUEDA_${key}`)
          .digest("hex");

        alertsToUpsert.push({
          alert_hash: alertHash,
          ano,
          mes,
          alert_type: "RECEITA_QUEDA",
          severity: "WARNING",
          title: "Queda expressiva de receita",
          description: `A receita bruta da Rede caiu ${dropPct.toFixed(1)}% comparado ao mês anterior (R$ ${prevRec.toLocaleString("pt-BR")} $\\rightarrow$ R$ ${rec.toLocaleString("pt-BR")}).`,
          metadata: { current_value: rec, previous_value: prevRec, drop_percent: dropPct, codigo_matriz: codigoMatriz },
        });
      }
    }
  });

  // B. EBITDA Negativo, Investimento Excessivo
  currentRows.forEach((row) => {
    const ebitdaVal = Number(row.ebitda) || 0;
    const receitaVal = Number(row.receita_bruta) || 0;
    const investVal = Number(row.investimento_comercial) || 0;

    // Margem EBITDA Crítica
    if (ebitdaVal < 0) {
      const alertHash = crypto
        .createHash("md5")
        .update(`${ano}_${mes}_MARGEM_CRITICA_${row.codigo_matriz}_${row.gerente_id}`)
        .digest("hex");

      alertsToUpsert.push({
        alert_hash: alertHash,
        ano,
        mes,
        alert_type: "MARGEM_CRITICA",
        severity: "CRITICAL",
        title: "EBITDA Negativo Detectado",
        description: `Operação gerou margem de contribuição ou EBITDA negativo de R$ ${ebitdaVal.toLocaleString("pt-BR")} mil na Rede.`,
        metadata: { ebitda: ebitdaVal, codigo_matriz: row.codigo_matriz },
      });
    }

    // Investimento Comercial Excessivo (>45%)
    if (receitaVal > 0) {
      const investRatio = investVal / receitaVal;
      if (investRatio > 0.45) {
        const alertHash = crypto
          .createHash("md5")
          .update(`${ano}_${mes}_INVESTIMENTO_EXCESSIVO_${row.codigo_matriz}_${row.gerente_id}`)
          .digest("hex");

        alertsToUpsert.push({
          alert_hash: alertHash,
          ano,
          mes,
          alert_type: "INVESTIMENTO_EXCESSIVO",
          severity: "CRITICAL",
          title: "Investimento comercial excessivo",
          description: `Investimento Comercial (R$ ${investVal.toLocaleString("pt-BR")}) representa ${(investRatio * 100).toFixed(1)}% da Receita Bruta, excedendo o limite crítico de 45%.`,
          metadata: { ratio: investRatio, receita: receitaVal, investimento: investVal, codigo_matriz: row.codigo_matriz },
        });
      }
    }
  });

  // C. Frete Anormal (>30% vs média de 3 meses históricos)
  // Buscamos faturamento/frete histórico da rede
  for (const row of currentRows) {
    const vol = Number(row.volume) || 0;
    const fret = Number(row.frete) || 0;
    if (vol <= 0 || fret <= 0) continue;

    const freteKg = fret / vol;

    // Média de frete_kg histórico nos últimos 3 meses
    const { data: histRows } = await supabase
      .from("cm_dre_financeiro")
      .select("volume, frete")
      .eq("codigo_matriz", row.codigo_matriz)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .or(`ano.eq.${ano},ano.eq.${ano - 1}`)
      .neq("mes", mes);

    const validHist = histRows?.filter(h => (Number(h.volume) || 0) > 0 && (Number(h.frete) || 0) > 0) || [];
    if (validHist.length > 0) {
      const avgHistFreteKg = validHist.reduce((acc, h) => acc + (Number(h.frete) / Number(h.volume)), 0) / validHist.length;
      if (freteKg > 1.30 * avgHistFreteKg) {
        const alertHash = crypto
          .createHash("md5")
          .update(`${ano}_${mes}_FRETE_ANORMAL_${row.codigo_matriz}`)
          .digest("hex");

        alertsToUpsert.push({
          alert_hash: alertHash,
          ano,
          mes,
          alert_type: "FRETE_ANORMAL",
          severity: "WARNING",
          title: "Custo de frete anormal",
          description: `Custo unitário de frete (R$ ${freteKg.toFixed(2)}/Ton) está ${( (freteKg / avgHistFreteKg - 1) * 100).toFixed(1)}% acima da média histórica recente (R$ ${avgHistFreteKg.toFixed(2)}/Ton).`,
          metadata: { frete_kg: freteKg, avg_hist_frete_kg: avgHistFreteKg, codigo_matriz: row.codigo_matriz },
        });
      }
    }
  }

  // Gravar alertas gerados no Supabase de forma deduplicada (ON CONFLICT DO UPDATE)
  for (const alert of alertsToUpsert) {
    await supabase
      .from("cm_dre_alerts")
      .upsert(alert, { onConflict: "alert_hash" });
  }

  return alertsToUpsert;
}

export async function desfazerImportacao(logId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  // Chamar stored procedure de rollback no banco
  const { error } = await supabase.rpc("rollback_import_log", {
    p_log_id: logId
  });

  if (error) {
    console.error("Erro ao desfazer importação:", error);
    throw new Error(`Falha ao desfazer importação: ${error.message}`);
  }

  revalidatePath("/dre/historico");
  revalidatePath("/dre");

  return { success: true };
}



