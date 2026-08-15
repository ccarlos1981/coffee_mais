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

// ─── helpers ─────────────────────────────────────────────────────────────────
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
          "id, rede, gerente_responsavel, valor_investimento, apuracao_valor_realizado, mes_referencia, fase_atual, apuracao_boleto_id, financeiro_pago_em, expectativa_volume, data_fim, date_mode, apuracao_preenchida_em, familias_detalhes, skus_detalhes"
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

      const redeName = (a.rede || "SEM REDE").trim();
      const redeKey = redeName.toUpperCase();
      const gerenteAcao = (a.gerente_responsavel || a.gerente || gerenteMap[redeKey] || "Sem Gerente").trim() || "Sem Gerente";
      const compositeKey = `${gerenteAcao}___${redeKey}`;
      const valor =
        (Number(a.valor_investimento) || 0) * (Number(a.expectativa_volume) || 1);

      if (!redeAgg[compositeKey]) {
        redeAgg[compositeKey] = {
          rede: redeName,
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
        const fat = fatMap[agg.rede.toUpperCase()] || 0;
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
  }, [rawAcoes, rawVinculoMap, gerenteMap, fatMap, selectedMes]);

  // Auto-expand all groups when grupos change
  useEffect(() => {
    setExpandedGerentes(new Set(grupos.map((g) => g.gerente)));
  }, [grupos]);

  // ─── derived ─────────────────────────────────────────────────────────────
  const gerentesDisponiveis = useMemo(
    () => grupos.map((g) => g.gerente),
    [grupos]
  );

  const filteredGrupos = useMemo(() => {
    let g = grupos;
    if (filterGerente) g = g.filter((gr) => gr.gerente === filterGerente);
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
      "Responsável", "Rede",
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
      <span className="text-slate-300 font-normal">—</span>
    ) : (
      <span className="text-emerald-700 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const CellAmber = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-slate-300 font-normal">—</span>
    ) : (
      <span className="text-amber-800 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const CellSky = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-slate-300 font-normal">—</span>
    ) : (
      <span className="text-sky-700 font-bold tabular-nums">{fmtCur(v)}</span>
    );

  const percColor = (p: number) =>
    p > 10
      ? "text-rose-600 font-extrabold"
      : p > 8
      ? "text-amber-700 font-bold"
      : "text-emerald-700 font-bold";

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 overflow-x-hidden font-sans print:bg-white print:p-0">
      {/* Print CSS override */}
      <style jsx global>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Top Bar / Navigation */}
      <header className="border-b border-slate-200/80 px-4 lg:px-6 py-3 sticky top-0 left-0 z-30 bg-white/90 backdrop-blur w-full shadow-2xs print:hidden">
        <div className="max-w-[1800px] mx-auto flex items-center gap-1.5 lg:gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          >
            <Home className="w-4 h-4" />
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/investimento" className="hidden sm:block text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors truncate">
            Investimento
          </Link>
          <span className="hidden sm:block text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-900 truncate">Invest. Cliente (Dash Resumido)</span>

          <div className="ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={loadData}
              disabled={loading}
              title="Atualizar"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={() => window.print()}
              title="Imprimir ou Salvar PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-all"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              onClick={exportCSV}
              disabled={loading || filteredGrupos.length === 0}
              title="Exportar CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-2xs transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 pt-5 pb-12">
        {/* Title & Control Panel */}
        <div className="mb-5 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs print:hidden">
          {/* Header Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs shrink-0">
                <TrendingDown className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight tracking-tight">
                  Relatório Executivo — Investimento por Cliente
                </h1>
                <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                  Mês de Referência: <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{mesLabel(selectedMes)}</span>
                </p>
              </div>
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                showFilters || searchTerm || filterGerente || selectedMes !== currentMonthKey()
                  ? "bg-slate-800 border-slate-800 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros
              {(searchTerm || filterGerente) && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                  {(searchTerm ? 1 : 0) + (filterGerente ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          {/* Filters Bar */}
          <div className={`${
            showFilters ? "flex" : "hidden lg:flex"
          } flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2.5 pt-4`}>
            {/* Search */}
            <div className="relative flex-1 min-w-0 lg:min-w-[200px] lg:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar rede ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:border-slate-400 transition-colors"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Gerente Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={filterGerente}
                onChange={(e) => setFilterGerente(e.target.value)}
                className="w-full lg:w-auto pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-slate-400 appearance-none cursor-pointer"
              >
                <option value="">Todos os responsáveis</option>
                {gerentesDisponiveis.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Month Selector */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full lg:w-auto pl-9 pr-8 py-1.5 text-xs bg-slate-800 border border-slate-800 text-white rounded-xl font-bold focus:outline-none appearance-none cursor-pointer"
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
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all"
            >
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              {expandedGerentes.size === filteredGrupos.length ? "Recolher Todos" : "Expandir Todos"}
            </button>

            {/* Month Toggle indicator */}
            <button
              onClick={() => setShowPastMonths((p) => !p)}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-sky-50/70 border border-sky-200/80 text-sky-800 hover:bg-sky-100/70 font-medium rounded-xl text-xs transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>
                Meses: {showPastMonths ? "Anteriores ‹" : "Futuros ›"} ({MONTHS.map((m) => m.label).join(", ")})
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
            <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
            <span className="ml-3 text-xs font-semibold text-slate-600">Carregando relatório executivo...</span>
          </div>
        ) : filteredGrupos.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200/80 rounded-2xl text-slate-500 text-xs font-medium shadow-2xs">
            Nenhum registro encontrado para <strong className="text-slate-800">{mesLabel(selectedMes)}</strong>.
          </div>
        ) : (
          <>
            {/* ── CARD EXECUTIVO DO TOTAL GERAL (ELEGANTE & LEVE) ── */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs p-4 sm:p-5 mb-6 print:mb-4 break-inside-avoid">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  <h2 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
                    TOTAL GERAL CONSOLIDADO
                  </h2>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    Ref: {mesLabel(selectedMes)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Visão Geral da Carteira
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* 1. Faturamento */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faturamento</span>
                  <div className="mt-1">
                    <span className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums leading-tight block">
                      {grandTotals.faturamento > 0 ? fmtCur(grandTotals.faturamento) : "—"}
                    </span>
                  </div>
                </div>

                {/* 2. Expectativa Invest. */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Expectativa Invest.</span>
                  <div className="mt-1">
                    <span className="text-lg sm:text-xl font-extrabold text-slate-900 tabular-nums leading-tight block">
                      {grandTotals.expectativaInvest > 0 ? fmtCur(grandTotals.expectativaInvest) : "—"}
                    </span>
                  </div>
                </div>

                {/* 3. % Invest. */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">% Invest. Médio</span>
                  <div className="mt-1">
                    <span className={`text-lg sm:text-xl font-extrabold tabular-nums leading-tight block ${
                      grandTotals.percInvest != null ? percColor(grandTotals.percInvest) : "text-slate-400"
                    }`}>
                      {grandTotals.percInvest != null ? `${grandTotals.percInvest.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </div>

                {/* 4. Não Provisionado */}
                <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Não Provisionado</span>
                  <div className="mt-1">
                    <span className="text-lg sm:text-xl font-extrabold text-amber-900 tabular-nums leading-tight block">
                      {grandTotals.naoProvisionado > 0 ? fmtCur(grandTotals.naoProvisionado) : "—"}
                    </span>
                  </div>
                </div>

                {/* 5. Provisionado */}
                <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Provisionado</span>
                  <div className="mt-1">
                    <span className="text-lg sm:text-xl font-extrabold text-emerald-900 tabular-nums leading-tight block">
                      {grandTotals.provisionado > 0 ? fmtCur(grandTotals.provisionado) : "—"}
                    </span>
                  </div>
                </div>

                {/* 6. Ações Atrasadas (SOFISTICADO & ELEGANTE) */}
                <div className={`border rounded-xl p-3 flex flex-col justify-between ${
                  grandTotals.acoesAtrasadas > 0
                    ? "bg-rose-50/60 border-rose-200"
                    : "bg-slate-50/60 border-slate-100"
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    grandTotals.acoesAtrasadas > 0 ? "text-rose-700" : "text-slate-400"
                  }`}>
                    Ações Atrasadas
                  </span>
                  <div className="mt-1 flex items-center justify-between">
                    {grandTotals.acoesAtrasadas > 0 ? (
                      <>
                        <span className="text-lg sm:text-xl font-black text-rose-600 tabular-nums leading-tight">
                          ● {grandTotals.acoesAtrasadas}
                        </span>
                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                          Atrasadas
                        </span>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 leading-tight">
                        0 ok
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── LISTAGEM DE CARDS POR GERENTE (SUTIL & SOFISTICADO) ── */}
            <div className="space-y-5 print:space-y-4">
              {filteredGrupos.map((grupo) => {
                const isExpanded = expandedGerentes.has(grupo.gerente);
                return (
                  <div
                    key={grupo.gerente}
                    className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden break-inside-avoid print:border-slate-300"
                  >
                    {/* Header do Gerente (Claro, Elegante, Sem Blocos Pretos) */}
                    <div
                      onClick={() => toggleGerente(grupo.gerente)}
                      className="bg-slate-50/80 hover:bg-slate-100/70 border-b border-slate-200/80 px-4 sm:px-5 py-3.5 cursor-pointer transition-colors flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="text-slate-400 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide uppercase">
                              {grupo.gerente}
                            </h3>
                            <span className="text-xs font-normal text-slate-400">
                              ({grupo.clientes.length} {grupo.clientes.length === 1 ? "cliente" : "clientes"})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* KPIs limpos no cabeçalho do Gerente */}
                      <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-600 ml-auto">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Faturamento</span>
                          <span className="font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : "—"}
                          </span>
                        </div>

                        <div className="hidden md:flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Expectativa</span>
                          <span className="font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : "—"}
                          </span>
                        </div>

                        <div className="hidden lg:flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">% Invest.</span>
                          <span className="font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {grupo.totals.percInvest != null ? `${grupo.totals.percInvest.toFixed(1)}%` : "—"}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Não Prov.</span>
                          <span className="font-bold text-amber-800 text-xs sm:text-sm tabular-nums">
                            {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : "—"}
                          </span>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">Provisionado</span>
                          <span className="font-bold text-emerald-700 text-xs sm:text-sm tabular-nums">
                            {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : "—"}
                          </span>
                        </div>

                        {/* Tratamento Sofisticado de Ações Atrasadas no Gerente */}
                        <div className="flex items-center">
                          {grupo.totals.acoesAtrasadas > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
                              <span>●</span>
                              <span>{grupo.totals.acoesAtrasadas} atrasadas</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal text-xs">
                              0 atrasos
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tabela de Redes do Gerente */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                              <th className="py-2.5 px-4 font-bold text-slate-700">Rede / Cliente</th>
                              <th className="py-2.5 px-4 text-right">Fat. ({mesLabel(selectedMes)})</th>
                              <th className="py-2.5 px-4 text-right">% Invest.</th>
                              <th className="py-2.5 px-4 text-right">Expect. Invest.</th>
                              <th className="py-2.5 px-4 text-right">Não Provisionado</th>
                              <th className="py-2.5 px-4 text-right">Provisionado</th>
                              <th className="py-2.5 px-4 text-center">Ações Atrasadas</th>
                              <th className="py-2.5 px-4 text-right text-sky-800 bg-sky-50/40">
                                Prov. Próximos Meses ({MONTHS.map((m) => m.label).join(" | ")})
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {grupo.clientes.map((c, idx) => (
                              <tr
                                key={`${grupo.gerente}__${c.rede}__${idx}`}
                                className="hover:bg-slate-50/60 transition-colors"
                              >
                                {/* Rede */}
                                <td className="py-2.5 px-4 font-semibold text-slate-900 text-xs whitespace-nowrap">
                                  {c.rede}
                                </td>
                                {/* Faturamento */}
                                <td className="py-2.5 px-4 text-right font-medium text-slate-800 tabular-nums whitespace-nowrap">
                                  {c.faturamento > 0 ? fmtCur(c.faturamento) : <span className="text-slate-300 font-normal">—</span>}
                                </td>
                                {/* % Invest */}
                                <td className="py-2.5 px-4 text-right font-semibold tabular-nums whitespace-nowrap">
                                  {c.percInvest != null ? (
                                    <span className={percColor(c.percInvest)}>
                                      {c.percInvest.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-normal">—</span>
                                  )}
                                </td>
                                {/* Expectativa */}
                                <td className="py-2.5 px-4 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                                  {c.expectativaInvest > 0 ? fmtCur(c.expectativaInvest) : <span className="text-slate-300 font-normal">—</span>}
                                </td>
                                {/* Não Provisionado */}
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                  <CellAmber v={c.naoProvisionado} />
                                </td>
                                {/* Provisionado */}
                                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                  <CellPos v={c.provisionado} />
                                </td>
                                {/* Ações Atrasadas (Sofisticado) */}
                                <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                  {c.acoesAtrasadas > 0 ? (
                                    <span className="text-rose-600 font-bold tabular-nums">
                                      ● {c.acoesAtrasadas}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 font-normal">—</span>
                                  )}
                                </td>
                                {/* Provisionamento Próximos Meses */}
                                <td className="py-2.5 px-4 text-right whitespace-nowrap bg-sky-50/20">
                                  <div className="flex items-center justify-end gap-3 font-medium text-sky-800 tabular-nums">
                                    {MONTHS.map((m) => {
                                      const val = c.meses[m.key] || 0;
                                      return (
                                        <div key={m.key} className="text-right">
                                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-normal">{m.label}</span>
                                          {val > 0 ? (
                                            <span className="text-sky-700 font-semibold">{fmtCur(val)}</span>
                                          ) : (
                                            <span className="text-slate-300 font-normal">—</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}

                            {/* Subtotal do Gerente */}
                            <tr className="bg-slate-50/80 font-bold text-slate-900 border-t border-slate-200">
                              <td className="py-2.5 px-4 text-slate-900 font-extrabold uppercase text-[11px]">
                                TOTAL — {grupo.gerente}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 tabular-nums text-xs">
                                {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold tabular-nums text-xs">
                                {grupo.totals.percInvest != null ? (
                                  <span className={percColor(grupo.totals.percInvest)}>
                                    {grupo.totals.percInvest.toFixed(1)}%
                                  </span>
                                ) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold text-slate-900 tabular-nums text-xs">
                                {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold text-amber-900 tabular-nums text-xs">
                                {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-right font-extrabold text-emerald-800 tabular-nums text-xs">
                                {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : <span className="text-slate-300 font-normal">—</span>}
                              </td>
                              <td className="py-2.5 px-4 text-center text-xs">
                                {grupo.totals.acoesAtrasadas > 0 ? (
                                  <span className="text-rose-600 font-extrabold tabular-nums">
                                    ● {grupo.totals.acoesAtrasadas}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-normal">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-right bg-sky-100/30">
                                <div className="flex items-center justify-end gap-3 font-extrabold text-sky-900 tabular-nums text-xs">
                                  {MONTHS.map((m) => {
                                    const val = grupo.totals.meses[m.key] || 0;
                                    return (
                                      <div key={m.key} className="text-right">
                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-medium">{m.label}</span>
                                        {val > 0 ? fmtCur(val) : <span className="text-slate-300 font-normal">—</span>}
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

        {/* Rodapé Executivo / Legenda */}
        <div className="flex flex-wrap items-center gap-4 mt-6 text-[11px] text-slate-500 bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs print:hidden">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" />
            <span>Expect. Investimento = valor × volume · mes_referencia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300" />
            <span>Não provisionado = sem boleto no mês selecionado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-300" />
            <span>Provisionado = com boleto vinculado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded bg-sky-100 border border-sky-300" />
            <span>Colunas de mês = vencimento futuro/passado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-rose-600 font-bold">●</span>
            <span>Ações Atrasadas = fase 3 com data_fim ≤ hoje - 7 dias</span>
          </div>
          <span className="ml-auto font-medium text-slate-400">Coffee++ Relatório Executivo</span>
        </div>
      </div>
    </div>
  );
}

