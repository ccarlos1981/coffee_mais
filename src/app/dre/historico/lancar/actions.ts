"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { DRE_LINHAS, DRESalvarInput, DREHistoricoRow } from "../constants";

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
