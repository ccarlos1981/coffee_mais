"use client";

import { OFFICIAL_ANALYTICS_SOURCES, resolveSupabaseTableName } from "@/lib/governance/analytics";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Home,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Users,
  TrendingDown,
  Calendar,
  Filter,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  SlidersHorizontal,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeProvider";
import { buildMatrizLookup, resolveClienteMatriz, MatrizLookup } from "@/lib/investimento/matriz-resolver";

// ─── helpers ─────────────────────────────────────────────────────────────────
const normalizeGerenteNome = (nome?: string | null): string => {
  if (!nome) return "Sem Gerente";
  const trimmed = nome.trim();
  if (!trimmed) return "Sem Gerente";
  const lower = trimmed.toLowerCase();
  if (lower === "john guedes" || lower === "john") return "John";
  if (lower === "leandro saffi" || lower === "leandro") return "Leandro";
  return trimmed;
};

const fmtCur = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const MES_ABREV: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

const mesLabel = (key: string) => {
  const [year, month] = key.split("-");
  return `${MES_ABREV[month] || month}/${year.slice(2)}`;
};

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Build 3 months past or future relative to a reference month
const buildMonths = (
  refMes: string,
  showPast: boolean
): { key: string; label: string }[] => {
  const [y, m] = refMes.split("-").map(Number);
  const result = [];
  for (let i = 1; i <= 3; i++) {
    const offset = showPast ? -i : i;
    const d = new Date(y, m - 1 + offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({ key, label: mesLabel(key) });
  }
  if (showPast) result.reverse(); // chronological
  return result;
};

// ─── types ───────────────────────────────────────────────────────────────────
interface AcaoRow {
  id: string;
  rede: string;
  codigo_matriz?: string | null;
  gerente_responsavel?: string | null;
  gerente?: string | null;
  valor_investimento: number | null;
  apuracao_valor_realizado: number | null;
  mes_referencia: string | null;
  fase_atual: number | null;
  apuracao_boleto_id: string | null;
  financeiro_pago_em: string | null;
  expectativa_volume: number | null;
  data_fim: string | null;
  date_mode: "single" | "multiple" | null;
  apuracao_preenchida_em: string | null;
  familias_detalhes?: any[] | null;
  skus_detalhes?: any[] | null;
}

interface VinculoRow {
  acao_id: string;
  valor_associado: number;
  boleto_vencimento: string | null;
}

interface ClienteData {
  rede: string;
  gerente: string;
  faturamento: number;       // fat do selectedMes
  percInvest: number | null; // (naoProvisionado + provisionado) / faturamento
  expectativaInvest: number; // ações com mes_referencia == selectedMes
  naoProvisionado: number;   // ações fechadas (fase>=5) sem boleto, mes_referencia == selectedMes
  provisionado: number;      // boletos com vencimento no selectedMes
  acoesAtrasadas: number;   // fase 3 + data_fim <= hoje-7
  meses: Record<string, number>; // provisionado por mês (para colunas toggle)
}

interface GrupoGerente {
  gerente: string;
  clientes: ClienteData[];
  totals: {
    faturamento: number;
    percInvest: number | null;
    expectativaInvest: number;
    naoProvisionado: number;
    provisionado: number;
    acoesAtrasadas: number;
    meses: Record<string, number>;
  };
}

// ─── component ───────────────────────────────────────────────────────────────
export default function InvestClientePage() {
  // ── selected month (filter for main columns) ──────────────────────────────
  const [selectedMes, setSelectedMes] = useState(currentMonthKey());
  // ── toggle past/future for side month columns ─────────────────────────────
  const [showPastMonths, setShowPastMonths] = useState(false);
  // ── mobile filter panel open/close ─────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);

  const MONTHS = useMemo(
    () => buildMonths(selectedMes, showPastMonths),
    [selectedMes, showPastMonths]
  );

  // ── raw data (fetched once) ────────────────────────────────────────────────
  const [rawAcoes, setRawAcoes] = useState<AcaoRow[]>([]);
  const [rawVinculoMap, setRawVinculoMap] = useState<Record<string, VinculoRow[]>>({});
  const [gerenteMap, setGerenteMap] = useState<Record<string, string>>({});
  const [matrizLookup, setMatrizLookup] = useState<MatrizLookup | null>(null);
  // ── faturamento per rede for the selected month ───────────────────────────
  const [fatMap, setFatMap] = useState<Record<string, number>>({});
  const [fatLoading, setFatLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [expandedGerentes, setExpandedGerentes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterGerente, setFilterGerente] = useState("");
  const [availableMeses, setAvailableMeses] = useState<string[]>([]);

  // ─── fetch all raw data once ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. All open investment actions with manager info
      const { data: acoes, error: aErr } = await supabase
        .from("v_acoes_investimento_com_gerente")
        .select(
          "id, rede, codigo_matriz, gerente_responsavel, valor_investimento, apuracao_valor_realizado, mes_referencia, fase_atual, apuracao_boleto_id, financeiro_pago_em, expectativa_volume, data_fim, date_mode, apuracao_preenchida_em, familias_detalhes, skus_detalhes"
        )
        .eq("is_planejamento", false)
        .is("financeiro_pago_em", null);

      if (aErr) throw aErr;

      // Available months for selector
      const meses = Array.from(
        new Set(
          (acoes as AcaoRow[])
            .map((a) => a.mes_referencia)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => b.localeCompare(a));
      setAvailableMeses(meses);
      setRawAcoes(acoes as AcaoRow[]);

      // 2. Boleto links
      const { data: vinculos, error: vErr } = await supabase
        .from("cm_acoes_boletos_vinculo")
        .select("acao_id, valor_associado, cm_boletos:boleto_id(vencimento)");

      if (vErr) throw vErr;

      const vMap: Record<string, VinculoRow[]> = {};
      (vinculos as any[]).forEach((v: any) => {
        const boleto = Array.isArray(v.cm_boletos) ? v.cm_boletos[0] : v.cm_boletos;
        const row: VinculoRow = {
          acao_id: v.acao_id,
          valor_associado: Number(v.valor_associado) || 0,
          boleto_vencimento: boleto?.vencimento ?? null,
        };
        if (!vMap[v.acao_id]) vMap[v.acao_id] = [];
        vMap[v.acao_id].push(row);
      });
      setRawVinculoMap(vMap);

      // 3. Matrizes → gerente map
      const { data: matrizes, error: mErr } = await supabase
        .from("v_redes_matrizes_detalhes")
        .select("nome, gerente");

      if (mErr) throw mErr;

      const gMap: Record<string, string> = {};
      (matrizes as any[]).forEach((m: any) => {
        if (m.nome)
          gMap[m.nome.toUpperCase().trim()] = m.gerente || "Sem Gerente";
      });
      setGerenteMap(gMap);

      // 4. Fonte Canônica cm_clientes para Resolução de Matrizes Sem Colisão
      let allClients: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: cChunk, error: cErr } = await supabase
          .from("cm_clientes")
          .select("codigo, codigo_matriz, matriz, uf, regional, responsavel, tipo_parceiro, nome_parceiro, razao_social")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (cErr) {
          console.error("Erro ao carregar cm_clientes em invest-cliente:", cErr);
          break;
        }
        if (!cChunk || cChunk.length === 0) break;
        allClients = [...allClients, ...cChunk];
        if (cChunk.length < pageSize) break;
        page++;
      }
      if (allClients.length > 0) {
        setMatrizLookup(buildMatrizLookup(allClients));
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── fetch faturamento for a specific month (called when selectedMes changes)
  const loadFat = useCallback(async (mes: string) => {
    setFatLoading(true);
    try {
      const { data: salesRows, error } = await supabase
        .from(resolveSupabaseTableName(OFFICIAL_ANALYTICS_SOURCES.VENDAS_MENSAL))
        .select("rede, fat")
        .eq("mes", mes)
        .limit(10000);

      if (error) {
        console.error("Erro faturamento:", error);
        return;
      }

      const fMap: Record<string, number> = {};
      (salesRows || []).forEach((row: any) => {
        const rk = (row.rede || "").toUpperCase().trim();
        if (rk) fMap[rk] = (fMap[rk] || 0) + (Number(row.fat) || 0);
      });
      setFatMap(fMap);
    } finally {
      setFatLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch faturamento whenever selectedMes changes
  useEffect(() => {
    loadFat(selectedMes);
  }, [selectedMes, loadFat]);

  // ─── compute grupos when raw data or selectedMes changes ─────────────────
  const grupos = useMemo<GrupoGerente[]>(() => {
    if (!rawAcoes.length && !Object.keys(rawVinculoMap).length) return [];

    // Cutoff: data_fim <= today - 7 days
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cutoff = new Date(hoje);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Aggregate per (gerente, rede) composite key
    const redeAgg: Record<
      string,
      {
        rede: string;
        rawRede?: string;
        gerente: string;
        expectativaInvest: number;
        naoProvisionado: number;
        provisionado: number;
        acoesAtrasadas: number;
        meses: Record<string, number>;
      }
    > = {};

    rawAcoes.forEach((a) => {
      // Fase 1 (Planej. GRV) não entra no painel
      if ((a.fase_atual ?? 0) === 1) return;

      const rawRedeName = (a.rede || "SEM REDE").trim();
      const rawRedeKey = rawRedeName.toUpperCase();

      const resolved = matrizLookup
        ? resolveClienteMatriz(
            {
              codigo_matriz: a.codigo_matriz,
              rede: a.rede,
              responsavel: a.gerente_responsavel,
            },
            matrizLookup
          )
        : null;

      const redeName = (resolved?.matriz || rawRedeName).trim();
      const redeKey = redeName.toUpperCase();
      const gerenteRaw = (a.gerente_responsavel || a.gerente || resolved?.responsavel || gerenteMap[redeKey] || gerenteMap[rawRedeKey] || "Sem Gerente").trim() || "Sem Gerente";
      const gerenteAcao = normalizeGerenteNome(gerenteRaw);
      const compositeKey = `${gerenteAcao}___${redeKey}`;
      const valor =
        (Number(a.valor_investimento) || 0) * (Number(a.expectativa_volume) || 1);

      if (!redeAgg[compositeKey]) {
        redeAgg[compositeKey] = {
          rede: redeName,
          rawRede: rawRedeName,
          gerente: gerenteAcao,
          expectativaInvest: 0,
          naoProvisionado: 0,
          provisionado: 0,
          acoesAtrasadas: 0,
          meses: {},
        };
      }

      // Expect. Investimento — only for selectedMes
      if (a.mes_referencia === selectedMes) {
        redeAgg[compositeKey].expectativaInvest += valor;
      }

      const vinculosAcao = rawVinculoMap[a.id] || [];
      const temBoleto = vinculosAcao.length > 0 || !!a.apuracao_boleto_id;
      const acaoNoMes = a.mes_referencia === selectedMes;

      if (vinculosAcao.length > 0) {
        // Provisionado via N:N link — soma TODOS os boletos da ação (sem filtrar por vencimento)
        vinculosAcao.forEach((v) => {
          const mesVenc = v.boleto_vencimento?.slice(0, 7) ?? "";
          if (acaoNoMes) {
            redeAgg[compositeKey].provisionado += v.valor_associado;
          }
          // Colunas de mês: ainda agrupa por vencimento (visão histórica/futura)
          if (mesVenc) {
            redeAgg[compositeKey].meses[mesVenc] =
              (redeAgg[compositeKey].meses[mesVenc] || 0) + v.valor_associado;
          }
        });
      } else if (a.apuracao_boleto_id) {
        // Provisionado via legacy field
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        const mesBoleto = a.mes_referencia || "";
        if (acaoNoMes) {
          redeAgg[compositeKey].provisionado += valorReal;
        }
        if (mesBoleto) {
          redeAgg[compositeKey].meses[mesBoleto] =
            (redeAgg[compositeKey].meses[mesBoleto] || 0) + valorReal;
        }
      } else if (!temBoleto && acaoNoMes) {
        // Não provisionado: qualquer ação sem boleto, no mês selecionado (qualquer fase)
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        redeAgg[compositeKey].naoProvisionado += valorReal;
      }

      // Ações atrasadas: apuracao_preenchida_em is null + (fase_atual <= 3) + date vencida (end_date < cutoffStr)
      if (!a.apuracao_preenchida_em && (a.fase_atual || 1) <= 3) {
        if (a.date_mode === "multiple") {
          let hasAtrasadoItem = false;
          if (a.familias_detalhes && a.familias_detalhes.length > 0) {
            hasAtrasadoItem = a.familias_detalhes.some((f: any) => f.end_date && f.end_date <= cutoffStr);
          }
          if (!hasAtrasadoItem && a.skus_detalhes && a.skus_detalhes.length > 0) {
            hasAtrasadoItem = a.skus_detalhes.some((s: any) => s.end_date && s.end_date <= cutoffStr);
          }
          if (hasAtrasadoItem) {
            redeAgg[compositeKey].acoesAtrasadas += 1;
          }
        } else {
          // single mode
          if (a.data_fim && a.data_fim <= cutoffStr) {
            redeAgg[compositeKey].acoesAtrasadas += 1;
          }
        }
      }
    });

    // Build clientes list
    const clientesList: ClienteData[] = Object.values(redeAgg)
      .filter((v) => v.expectativaInvest > 0 || v.provisionado > 0 || v.naoProvisionado > 0)
      .map((agg) => {
        const fat = fatMap[agg.rede.toUpperCase()] || (agg.rawRede ? fatMap[agg.rawRede.toUpperCase()] : 0) || 0;
        const perc =
          fat > 0 ? ((agg.naoProvisionado + agg.provisionado) / fat) * 100 : null;
        return {
          rede: agg.rede,
          gerente: agg.gerente,
          faturamento: fat,
          percInvest: perc,
          expectativaInvest: agg.expectativaInvest,
          naoProvisionado: agg.naoProvisionado,
          provisionado: agg.provisionado,
          acoesAtrasadas: agg.acoesAtrasadas,
          meses: agg.meses,
        };
      })
      .sort((a, b) => b.expectativaInvest - a.expectativaInvest);

    // Group by gerente
    const gerenteGroups: Record<string, ClienteData[]> = {};
    clientesList.forEach((c) => {
      if (!gerenteGroups[c.gerente]) gerenteGroups[c.gerente] = [];
      gerenteGroups[c.gerente].push(c);
    });

    const grupoList: GrupoGerente[] = Object.entries(gerenteGroups)
      .map(([gerente, clientes]) => {
        const totals = clientes.reduce(
          (acc, c) => {
            acc.faturamento += c.faturamento;
            acc.expectativaInvest += c.expectativaInvest;
            acc.naoProvisionado += c.naoProvisionado;
            acc.provisionado += c.provisionado;
            acc.acoesAtrasadas += c.acoesAtrasadas;
            Object.entries(c.meses).forEach(([mk, mv]) => {
              acc.meses[mk] = (acc.meses[mk] || 0) + mv;
            });
            return acc;
          },
          {
            faturamento: 0,
            expectativaInvest: 0,
            naoProvisionado: 0,
            provisionado: 0,
            acoesAtrasadas: 0,
            meses: {} as Record<string, number>,
          }
        );
        const percInvest =
          totals.faturamento > 0
            ? ((totals.naoProvisionado + totals.provisionado) / totals.faturamento) * 100
            : null;
        return { gerente, clientes, totals: { ...totals, percInvest } };
      })
      .sort((a, b) => b.totals.expectativaInvest - a.totals.expectativaInvest);

    return grupoList;
  }, [rawAcoes, rawVinculoMap, gerenteMap, fatMap, selectedMes, matrizLookup]);

  // Auto-expand all groups when grupos change
  useEffect(() => {
    setExpandedGerentes(new Set(grupos.map((g) => g.gerente)));
  }, [grupos]);

  // ─── derived ─────────────────────────────────────────────────────────────
  const gerentesDisponiveis = useMemo(
    () => Array.from(new Set([...grupos.map((g) => normalizeGerenteNome(g.gerente)), "John"])).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [grupos]
  );

  const filteredGrupos = useMemo(() => {
    let g = grupos;
    if (filterGerente) {
      const normG = normalizeGerenteNome(filterGerente);
      g = g.filter((gr) => normalizeGerenteNome(gr.gerente) === normG);
    }
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      g = g
        .map((gr) => ({
          ...gr,
          clientes: gr.clientes.filter((c) => c.rede.toLowerCase().includes(s)),
        }))
        .filter((gr) => gr.clientes.length > 0);
    }
    return g;
  }, [grupos, filterGerente, searchTerm]);

  const grandTotals = useMemo(() => {
    const base = filteredGrupos.reduce(
      (acc, g) => {
        acc.faturamento += g.totals.faturamento;
        acc.expectativaInvest += g.totals.expectativaInvest;
        acc.naoProvisionado += g.totals.naoProvisionado;
        acc.provisionado += g.totals.provisionado;
        acc.acoesAtrasadas += g.totals.acoesAtrasadas;
        Object.entries(g.totals.meses).forEach(([mk, mv]) => {
          acc.meses[mk] = (acc.meses[mk] || 0) + mv;
        });
        return acc;
      },
      {
        faturamento: 0,
        expectativaInvest: 0,
        naoProvisionado: 0,
        provisionado: 0,
        acoesAtrasadas: 0,
        meses: {} as Record<string, number>,
      }
    );
    return {
      ...base,
      percInvest:
        base.faturamento > 0
          ? ((base.naoProvisionado + base.provisionado) / base.faturamento) * 100
          : null,
    };
  }, [filteredGrupos]);

  const toggleGerente = (gerente: string) => {
    setExpandedGerentes((prev) => {
      const next = new Set(prev);
      if (next.has(gerente)) next.delete(gerente);
      else next.add(gerente);
      return next;
    });
  };

  // ─── CSV export ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      "Responsável", "Matriz",
      `Fat. ${mesLabel(selectedMes)}`, "% Invest.",
      "Expect. Investimento", "Não provisionado", "Provisionado",
      ...MONTHS.map((m) => m.label),
    ];
    const rows: string[][] = [];
    filteredGrupos.forEach((g) => {
      g.clientes.forEach((c) => {
        rows.push([
          g.gerente, c.rede,
          String(c.faturamento),
          c.percInvest != null ? c.percInvest.toFixed(2) + "%" : "-",
          String(c.expectativaInvest),
          String(c.naoProvisionado),
          String(c.provisionado),
          ...MONTHS.map((m) => String(c.meses[m.key] || 0)),
        ]);
      });
      rows.push([
        `${g.gerente} Total`, "",
        String(g.totals.faturamento),
        g.totals.percInvest != null ? g.totals.percInvest.toFixed(2) + "%" : "-",
        String(g.totals.expectativaInvest),
        String(g.totals.naoProvisionado),
        String(g.totals.provisionado),
        ...MONTHS.map((m) => String(g.totals.meses[m.key] || 0)),
      ]);
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invest_cliente.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── cell helpers ─────────────────────────────────────────────────────────
  const CellPos = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-gray-300 font-normal">—</span>
    ) : (
      <span className="text-emerald-700 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const CellAmber = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-gray-300 font-normal">—</span>
    ) : (
      <span className="text-amber-700 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const CellSky = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-gray-300 font-normal">—</span>
    ) : (
      <span className="text-blue-700 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const percColor = (p: number) =>
    p > 10
      ? "text-red-600 font-extrabold"
      : p > 8
      ? "text-amber-700 font-bold"
      : "text-emerald-700 font-bold";

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden font-sans">
      {/* Print CSS — comprehensive rules for screenshot & PDF */}
      <style jsx global>{`
        @media print {
          html, body {
            background-color: #ffffff !important;
            color: #111827 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-hide {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-border {
            border-color: #d1d5db !important;
          }
          @page {
            margin: 1cm;
            size: landscape;
          }
          /* Force red on overdue badges */
          .print-red { color: #dc2626 !important; }
          .print-green { color: #047857 !important; }
          .print-blue { color: #1d4ed8 !important; }
          /* Remove hover backgrounds */
          tr:hover { background: transparent !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TOP BAR — solid white, no blur, high contrast                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <header className="border-b border-gray-200 px-4 lg:px-6 py-3 sticky top-0 left-0 z-30 bg-white w-full shadow-sm print-hide">
        <div className="max-w-[1600px] mx-auto flex items-center gap-2 lg:gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
          >
            <Home className="w-4 h-4" />
          </Link>
          <span className="text-gray-300">/</span>
          <Link href="/investimento" className="hidden sm:block text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors truncate">
            Investimento
          </Link>
          <span className="hidden sm:block text-gray-300">/</span>
          <span className="text-sm font-bold text-gray-900 truncate">Invest. Cliente</span>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={loadData}
              disabled={loading}
              title="Atualizar"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={() => window.print()}
              title="Imprimir ou Salvar PDF"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm transition-all"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              onClick={exportCSV}
              disabled={loading || filteredGrupos.length === 0}
              title="Exportar CSV"
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-gray-600" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MAIN CONTENT                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 pt-5 pb-12">

        {/* ── TITLE & FILTERS PANEL ── */}
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm print-hide">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-900 text-white shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight tracking-tight">
                  Relatório Executivo — Invest. Cliente
                </h1>
                <p className="text-sm text-gray-500 font-medium mt-0.5">
                  Referência: <span className="font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">{mesLabel(selectedMes)}</span>
                </p>
              </div>
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`lg:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                showFilters || searchTerm || filterGerente || selectedMes !== currentMonthKey()
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {(searchTerm || filterGerente) && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {(searchTerm ? 1 : 0) + (filterGerente ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filters Bar */}
          <div className={`${
            showFilters ? "flex" : "hidden lg:flex"
          } flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-3 pt-4`}>
            {/* Search */}
            <div className="relative flex-1 min-w-0 lg:min-w-[220px] lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar rede ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Gerente Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={filterGerente}
                onChange={(e) => setFilterGerente(e.target.value)}
                className="w-full lg:w-auto pl-10 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-gray-300 appearance-none cursor-pointer"
              >
                <option value="">Todos os responsáveis</option>
                {gerentesDisponiveis.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full lg:w-auto pl-10 pr-8 py-2 text-sm bg-gray-900 border border-gray-900 text-white rounded-lg font-bold focus:outline-none appearance-none cursor-pointer"
              >
                {[currentMonthKey(), ...availableMeses]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .sort((a, b) => b.localeCompare(a))
                  .map((m) => (
                    <option key={m} value={m}>{m} — {mesLabel(m)}</option>
                  ))}
              </select>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={() => {
                if (expandedGerentes.size === filteredGrupos.length) {
                  setExpandedGerentes(new Set());
                } else {
                  setExpandedGerentes(new Set(filteredGrupos.map((g) => g.gerente)));
                }
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg transition-all"
            >
              <ChevronDown className="w-4 h-4 text-gray-500" />
              {expandedGerentes.size === filteredGrupos.length ? "Recolher Todos" : "Expandir Todos"}
            </button>

            {/* Month Toggle indicator */}
            <button
              onClick={() => setShowPastMonths((p) => !p)}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 font-medium rounded-lg text-sm transition-all"
            >
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                {showPastMonths ? "◂ Anteriores" : "Futuros ▸"} ({MONTHS.map((m) => m.label).join(", ")})
              </span>
            </button>
          </div>
        </div>

        {/* ── CONTENT BODY ── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 bg-white border border-gray-200 rounded-xl shadow-sm">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            <span className="ml-3 text-base font-semibold text-gray-500">Carregando relatório executivo...</span>
          </div>
        ) : filteredGrupos.length === 0 ? (
          <div className="text-center py-24 bg-white border border-gray-200 rounded-xl text-gray-500 text-base font-medium shadow-sm">
            Nenhum registro encontrado para <strong className="text-gray-900">{mesLabel(selectedMes)}</strong>.
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* CARD TOTAL GERAL — Executive KPIs with large typography      */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white border-2 border-gray-900 rounded-xl p-5 sm:p-6 mb-8 break-inside-avoid print-border">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-gray-200 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-gray-900" />
                  <h2 className="text-base sm:text-lg font-black text-gray-900 uppercase tracking-wider">
                    Total Geral Consolidado
                  </h2>
                </div>
                <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-md">
                  {mesLabel(selectedMes)}
                </span>
              </div>

              {/* KPI Grid — large values */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* 1. Faturamento */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Faturamento</span>
                  <span className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums leading-none block">
                    {grandTotals.faturamento > 0 ? fmtCur(grandTotals.faturamento) : "—"}
                  </span>
                </div>

                {/* 2. Expectativa Invest. */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">Expectativa Invest.</span>
                  <span className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums leading-none block">
                    {grandTotals.expectativaInvest > 0 ? fmtCur(grandTotals.expectativaInvest) : "—"}
                  </span>
                </div>

                {/* 3. % Invest. */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-2">% Invest.</span>
                  <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none block ${
                    grandTotals.percInvest != null ? percColor(grandTotals.percInvest) : "text-gray-400"
                  }`}>
                    {grandTotals.percInvest != null ? `${grandTotals.percInvest.toFixed(1)}%` : "—"}
                  </span>
                </div>

                {/* 4. Não Provisionado */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 block mb-2">Não Provisionado</span>
                  <span className="text-xl sm:text-2xl font-black text-amber-800 tabular-nums leading-none block">
                    {grandTotals.naoProvisionado > 0 ? fmtCur(grandTotals.naoProvisionado) : "—"}
                  </span>
                </div>

                {/* 5. Provisionado */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-2">Provisionado</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-800 tabular-nums leading-none block print-green">
                    {grandTotals.provisionado > 0 ? fmtCur(grandTotals.provisionado) : "—"}
                  </span>
                </div>

                {/* 6. Ações Atrasadas — HIGH VISIBILITY */}
                <div className={`border-2 rounded-lg p-4 ${
                  grandTotals.acoesAtrasadas > 0
                    ? "bg-red-50 border-red-300"
                    : "bg-gray-50 border-gray-200"
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                    grandTotals.acoesAtrasadas > 0 ? "text-red-700" : "text-gray-500"
                  }`}>
                    Ações Atrasadas
                  </span>
                  {grandTotals.acoesAtrasadas > 0 ? (
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-red-600 tabular-nums leading-none print-red">
                        {grandTotals.acoesAtrasadas}
                      </span>
                      <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded-md border border-red-200">
                        🔴 ATRASADAS
                      </span>
                    </div>
                  ) : (
                    <span className="text-lg font-semibold text-gray-400 leading-none block">
                      0
                    </span>
                  )}
                </div>
              </div>

              {/* Provisionamento Futuro — secondary sub-section */}
              {MONTHS.some((m) => (grandTotals.meses[m.key] || 0) > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap items-center gap-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      Prov. Próximos Meses
                    </span>
                    {MONTHS.map((m) => {
                      const val = grandTotals.meses[m.key] || 0;
                      return (
                        <div key={m.key} className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">{m.label}:</span>
                          {val > 0 ? (
                            <span className="text-sm font-bold text-blue-700 tabular-nums print-blue">{fmtCur(val)}</span>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* GERENTE BLOCKS — each with prominent header + table          */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="space-y-6">
              {filteredGrupos.map((grupo) => {
                const isExpanded = expandedGerentes.has(grupo.gerente);
                return (
                  <div
                    key={grupo.gerente}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden break-inside-avoid print-border"
                  >
                    {/* ── Gerente Header — large name, KPIs in grid ── */}
                    <div
                      onClick={() => toggleGerente(grupo.gerente)}
                      className="bg-gray-50 hover:bg-gray-100 border-b-2 border-gray-200 px-5 py-4 cursor-pointer transition-colors"
                    >
                      {/* Top Row: Name + Expand */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-gray-400 shrink-0">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5" />
                            ) : (
                              <ChevronRightIcon className="w-5 h-5" />
                            )}
                          </div>
                          <h3 className="text-lg sm:text-xl font-black text-gray-900 tracking-wide uppercase">
                            {grupo.gerente}
                          </h3>
                          <span className="text-sm font-medium text-gray-500 bg-white px-2.5 py-0.5 rounded-md border border-gray-200">
                            {grupo.clientes.length} {grupo.clientes.length === 1 ? "cliente" : "clientes"}
                          </span>
                        </div>

                        {/* Overdue badge — always visible */}
                        {grupo.totals.acoesAtrasadas > 0 && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 border border-red-300 text-red-700 font-black text-sm print-red">
                            🔴 {grupo.totals.acoesAtrasadas} atrasadas
                          </span>
                        )}
                      </div>

                      {/* KPI Row — compact grid for screenshot readability */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pl-8">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Faturamento</span>
                          <span className="text-base sm:text-lg font-black text-gray-900 tabular-nums">
                            {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">Expectativa</span>
                          <span className="text-base sm:text-lg font-black text-gray-900 tabular-nums">
                            {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">% Invest.</span>
                          <span className={`text-base sm:text-lg font-black tabular-nums ${
                            grupo.totals.percInvest != null ? percColor(grupo.totals.percInvest) : "text-gray-400"
                          }`}>
                            {grupo.totals.percInvest != null ? `${grupo.totals.percInvest.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-amber-600 font-bold block">Não Prov.</span>
                          <span className="text-base sm:text-lg font-black text-amber-700 tabular-nums">
                            {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold block">Provisionado</span>
                          <span className="text-base sm:text-lg font-black text-emerald-700 tabular-nums print-green">
                            {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Table of Networks (Redes) ── */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b-2 border-gray-200">
                              <th className="py-3 px-5 text-xs font-black text-gray-700 uppercase tracking-wider">Matriz</th>
                              <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Fat. {mesLabel(selectedMes)}</th>
                              <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">% Inv.</th>
                              <th className="py-3 px-4 text-xs font-bold text-gray-600 uppercase tracking-wider text-right">Expect.</th>
                              <th className="py-3 px-4 text-xs font-bold text-amber-700 uppercase tracking-wider text-right">Não Prov.</th>
                              <th className="py-3 px-4 text-xs font-bold text-emerald-700 uppercase tracking-wider text-right">Prov.</th>
                              <th className="py-3 px-3 text-xs font-bold text-red-700 uppercase tracking-wider text-center">Atrasadas</th>
                              <th className="py-3 px-4 text-xs font-bold text-blue-700 uppercase tracking-wider text-right bg-blue-50/50">
                                {MONTHS.map((m) => m.label).join(" · ")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {grupo.clientes.map((c, idx) => (
                              <tr
                                key={`${grupo.gerente}__${c.rede}__${idx}`}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                {/* Rede */}
                                <td className="py-3 px-5 font-bold text-gray-900 text-sm whitespace-nowrap">
                                  {c.rede}
                                </td>
                                {/* Faturamento */}
                                <td className="py-3 px-4 text-right font-semibold text-gray-800 tabular-nums text-sm whitespace-nowrap">
                                  {c.faturamento > 0 ? fmtCur(c.faturamento) : <span className="text-gray-300">—</span>}
                                </td>
                                {/* % Invest */}
                                <td className="py-3 px-4 text-right font-bold tabular-nums text-sm whitespace-nowrap">
                                  {c.percInvest != null ? (
                                    <span className={percColor(c.percInvest)}>
                                      {c.percInvest.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                {/* Expectativa */}
                                <td className="py-3 px-4 text-right font-semibold text-gray-800 tabular-nums text-sm whitespace-nowrap">
                                  {c.expectativaInvest > 0 ? fmtCur(c.expectativaInvest) : <span className="text-gray-300">—</span>}
                                </td>
                                {/* Não Provisionado */}
                                <td className="py-3 px-4 text-right text-sm whitespace-nowrap">
                                  <CellAmber v={c.naoProvisionado} />
                                </td>
                                {/* Provisionado */}
                                <td className="py-3 px-4 text-right text-sm whitespace-nowrap">
                                  <CellPos v={c.provisionado} />
                                </td>
                                {/* Ações Atrasadas — BOLD RED */}
                                <td className="py-3 px-3 text-center whitespace-nowrap">
                                  {c.acoesAtrasadas > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-black text-sm tabular-nums print-red">
                                      {c.acoesAtrasadas}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                {/* Provisionamento Próximos Meses */}
                                <td className="py-3 px-4 text-right whitespace-nowrap bg-blue-50/30">
                                  <div className="flex items-center justify-end gap-4 tabular-nums">
                                    {MONTHS.map((m) => {
                                      const val = c.meses[m.key] || 0;
                                      return (
                                        <div key={m.key} className="text-right min-w-[4.5rem]">
                                          <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-semibold">{m.label}</span>
                                          {val > 0 ? (
                                            <span className="text-blue-700 font-bold text-sm print-blue">{fmtCur(val)}</span>
                                          ) : (
                                            <span className="text-gray-300">—</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {/* ── Subtotal do Gerente ── */}
                            <tr className="bg-gray-100 border-t-2 border-gray-300">
                              <td className="py-3 px-5 text-gray-900 font-black uppercase text-xs tracking-wide">
                                Total — {grupo.gerente}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-gray-900 tabular-nums text-sm">
                                {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-black tabular-nums text-sm">
                                {grupo.totals.percInvest != null ? (
                                  <span className={percColor(grupo.totals.percInvest)}>
                                    {grupo.totals.percInvest.toFixed(1)}%
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-gray-900 tabular-nums text-sm">
                                {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-amber-800 tabular-nums text-sm">
                                {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-700 tabular-nums text-sm print-green">
                                {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {grupo.totals.acoesAtrasadas > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-black text-sm tabular-nums print-red">
                                    {grupo.totals.acoesAtrasadas}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right bg-blue-50/40">
                                <div className="flex items-center justify-end gap-4 font-black text-blue-800 tabular-nums text-sm">
                                  {MONTHS.map((m) => {
                                    const val = grupo.totals.meses[m.key] || 0;
                                    return (
                                      <div key={m.key} className="text-right min-w-[4.5rem]">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-bold">{m.label}</span>
                                        {val > 0 ? <span className="print-blue">{fmtCur(val)}</span> : <span className="text-gray-300">—</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Rodapé / Legenda ── */}
        <div className="flex flex-wrap items-center gap-5 mt-8 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4 print-hide">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-gray-200 border border-gray-300" />
            <span className="font-medium">Expectativa = valor × volume</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300" />
            <span className="font-medium">Não prov. = sem boleto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="font-medium">Provisionado = com boleto</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            <span className="font-medium">Meses = vencimento futuro/passado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-3 h-3 rounded bg-red-100 border border-red-300 text-red-600 text-[8px] font-black">!</span>
            <span className="font-medium">Atrasadas = fase ≤ 3 + data_fim ≤ hoje − 7d</span>
          </div>
          <span className="ml-auto font-bold text-gray-400 tracking-wide">Coffee++ Relatório Executivo</span>
        </div>
      </div>
    </div>
  );
}

