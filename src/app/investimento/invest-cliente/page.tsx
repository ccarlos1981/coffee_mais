"use client";

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
  valor_investimento: number | null;
  apuracao_valor_realizado: number | null;
  mes_referencia: string | null;
  fase_atual: number | null;
  apuracao_boleto_id: string | null;
  financeiro_pago_em: string | null;
  expectativa_volume: number | null;
  data_fim: string | null;
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
      // 1. All open investment actions
      const { data: acoes, error: aErr } = await supabase
        .from("cm_acoes_investimento")
        .select(
          "id, rede, valor_investimento, apuracao_valor_realizado, mes_referencia, fase_atual, apuracao_boleto_id, financeiro_pago_em, expectativa_volume, data_fim"
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
        .from("mv_vendas_mensal")
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

    // Aggregate per rede
    const redeAgg: Record<
      string,
      {
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

      const redeKey = (a.rede || "SEM REDE").toUpperCase().trim();
      const valor =
        (Number(a.valor_investimento) || 0) * (Number(a.expectativa_volume) || 1);

      if (!redeAgg[redeKey]) {
        redeAgg[redeKey] = {
          gerente: gerenteMap[redeKey] || "Sem Gerente",
          expectativaInvest: 0,
          naoProvisionado: 0,
          provisionado: 0,
          acoesAtrasadas: 0,
          meses: {},
        };
      }

      // Expect. Investimento — only for selectedMes
      if (a.mes_referencia === selectedMes) {
        redeAgg[redeKey].expectativaInvest += valor;
      }

      const vinculosAcao = rawVinculoMap[a.id] || [];
      const temBoleto = vinculosAcao.length > 0 || !!a.apuracao_boleto_id;
      const acaoNoMes = a.mes_referencia === selectedMes;

      if (vinculosAcao.length > 0) {
        // Provisionado via N:N link — soma TODOS os boletos da ação (sem filtrar por vencimento)
        vinculosAcao.forEach((v) => {
          const mesVenc = v.boleto_vencimento?.slice(0, 7) ?? "";
          if (acaoNoMes) {
            redeAgg[redeKey].provisionado += v.valor_associado;
          }
          // Colunas de mês: ainda agrupa por vencimento (visão histórica/futura)
          if (mesVenc) {
            redeAgg[redeKey].meses[mesVenc] =
              (redeAgg[redeKey].meses[mesVenc] || 0) + v.valor_associado;
          }
        });
      } else if (a.apuracao_boleto_id) {
        // Provisionado via legacy field
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        const mesBoleto = a.mes_referencia || "";
        if (acaoNoMes) {
          redeAgg[redeKey].provisionado += valorReal;
        }
        if (mesBoleto) {
          redeAgg[redeKey].meses[mesBoleto] =
            (redeAgg[redeKey].meses[mesBoleto] || 0) + valorReal;
        }
      } else if (!temBoleto && acaoNoMes) {
        // Não provisionado: qualquer ação sem boleto, no mês selecionado (qualquer fase)
        const valorReal = Number(a.apuracao_valor_realizado) || valor;
        redeAgg[redeKey].naoProvisionado += valorReal;
      }

      // Ações atrasadas: fase 3 + data_fim <= hoje-7
      if (
        a.fase_atual === 3 &&
        a.data_fim &&
        a.data_fim <= cutoffStr
      ) {
        redeAgg[redeKey].acoesAtrasadas += 1;
      }
    });

    // Build clientes list
    const clientesList: ClienteData[] = Object.entries(redeAgg)
      .filter(([, v]) => v.expectativaInvest > 0 || v.provisionado > 0 || v.naoProvisionado > 0)
      .map(([rede, agg]) => {
        const fat = fatMap[rede] || 0;
        const perc =
          fat > 0 ? ((agg.naoProvisionado + agg.provisionado) / fat) * 100 : null;
        return {
          rede,
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
      <span className="text-muted">-</span>
    ) : (
      <span className="text-emerald-400 font-medium">{fmtCur(v)}</span>
    );

  const CellAmber = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-muted">-</span>
    ) : (
      <span className="text-amber-400 font-medium">{fmtCur(v)}</span>
    );

  const CellSky = ({ v }: { v: number }) =>
    v === 0 ? (
      <span className="text-muted">-</span>
    ) : (
      <span className="text-sky-400">{fmtCur(v)}</span>
    );

  const percColor = (p: number) =>
    p > 10
      ? "text-rose-400 font-semibold"
      : p > 8
      ? "text-amber-400"
      : "text-emerald-400";

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border px-4 lg:px-6 py-3 sticky top-0 left-0 z-30 bg-background/95 backdrop-blur w-full">
        <div className="max-w-[1800px] mx-auto flex items-center gap-1.5 lg:gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
          >
            <Home className="w-4 h-4" />
          </Link>
          <span className="text-border">/</span>
          <Link href="/investimento" className="hidden sm:block text-xs text-muted hover:text-foreground transition-colors truncate">
            Investimento
          </Link>
          <span className="hidden sm:block text-border">/</span>
          <span className="text-xs font-semibold text-foreground truncate">Invest. Cliente</span>

          <div className="ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
            <ThemeToggle />
            <button
              onClick={loadData}
              disabled={loading}
              title="Atualizar"
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={exportCSV}
              disabled={loading || filteredGrupos.length === 0}
              title="Exportar CSV"
              className="flex items-center gap-1.5 px-2 lg:px-3 py-1.5 text-xs font-semibold text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page title + filters */}
      <div className="max-w-[1800px] mx-auto px-4 lg:px-6 pt-4 pb-3">
        {/* Title row: always visible */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 shadow-sm shrink-0">
            <TrendingDown className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground leading-tight">Invest. Cliente</h1>
            <p className="text-[11px] text-muted truncate">
              Referência: <span className="font-semibold text-foreground">{mesLabel(selectedMes)}</span>
            </p>
          </div>

          {/* Mobile: filter toggle button */}
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              showFilters || searchTerm || filterGerente || selectedMes !== currentMonthKey()
                ? "bg-gold/10 border-gold/40 text-gold"
                : "bg-elevated border-border text-muted hover:text-foreground"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtros
            {(searchTerm || filterGerente) && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gold text-background text-[9px] font-bold">
                {(searchTerm ? 1 : 0) + (filterGerente ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filters: always visible on desktop, collapsible on mobile */}
        <div className={`${
          showFilters ? "flex" : "hidden lg:flex"
        } flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2`}>
          {/* Search */}
          <div className="relative flex-1 min-w-0 lg:min-w-[180px] lg:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar rede/cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-8 py-2 lg:py-1.5 text-sm lg:text-xs bg-elevated border border-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-gold transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Gerente filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <select
              value={filterGerente}
              onChange={(e) => setFilterGerente(e.target.value)}
              className="w-full lg:w-auto pl-8 pr-6 py-2 lg:py-1.5 text-sm lg:text-xs bg-elevated border border-border rounded-lg text-foreground focus:outline-none focus:border-gold appearance-none cursor-pointer"
            >
              <option value="">Todos os responsáveis</option>
              {gerentesDisponiveis.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
            <select
              value={selectedMes}
              onChange={(e) => setSelectedMes(e.target.value)}
              className="w-full lg:w-auto pl-8 pr-6 py-2 lg:py-1.5 text-sm lg:text-xs bg-elevated border border-border rounded-lg text-foreground focus:outline-none focus:border-gold appearance-none cursor-pointer font-semibold"
            >
              {[currentMonthKey(), ...availableMeses]
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => b.localeCompare(a))
                .map((m) => (
                  <option key={m} value={m}>{m} — {mesLabel(m)}</option>
                ))}
            </select>
          </div>

          {/* Expand / collapse */}
          <button
            onClick={() => {
              if (expandedGerentes.size === filteredGrupos.length) {
                setExpandedGerentes(new Set());
              } else {
                setExpandedGerentes(new Set(filteredGrupos.map((g) => g.gerente)));
              }
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-2 lg:py-1.5 text-sm lg:text-xs font-semibold text-muted hover:text-foreground bg-elevated hover:bg-border border border-border rounded-lg transition-all"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            {expandedGerentes.size === filteredGrupos.length ? "Recolher" : "Expandir"}
          </button>

          {/* Month range indicator */}
          <div className="ml-auto flex items-center gap-1.5 px-3 py-2 lg:py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-xs font-semibold text-sky-400">
              {showPastMonths ? "↑ anteriores" : "↓ seguintes"}: {MONTHS.map((m) => m.label).join(", ")}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-[1800px] mx-auto px-3 lg:px-6 pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-muted animate-spin" />
            <span className="ml-3 text-sm text-muted">Carregando...</span>
          </div>
        ) : filteredGrupos.length === 0 ? (
          <div className="text-center py-20 text-muted text-sm">
            Nenhum dado encontrado para <strong>{mesLabel(selectedMes)}</strong>.
          </div>
        ) : (
          <>
          {/* ── Desktop: tabela horizontal ────────────────────────────── */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-border shadow-sm">
            <table className="w-full text-xs border-collapse">
              {/* ── THEAD ────────────────────────────────────────────────── */}
              <thead>
                {/* Group row */}
                <tr className="bg-elevated border-b border-border">
                  <th colSpan={2} className="px-3 py-2" />
                  <th
                    colSpan={2}
                    className="text-center px-3 py-2 text-muted font-semibold tracking-wide uppercase text-[10px] border-r border-border/50"
                  >
                    Faturamento
                  </th>
                  <th
                    colSpan={4}
                    className="text-center px-3 py-2 text-muted font-semibold tracking-wide uppercase text-[10px] border-r border-border"
                  >
                    Valores · {mesLabel(selectedMes)}
                  </th>
                  {/* Toggle button + month cols */}
                  <th
                    colSpan={1 + MONTHS.length}
                    className="text-center px-3 py-2 text-muted font-semibold tracking-wide uppercase text-[10px]"
                  >
                    Provisionado por mês
                  </th>
                </tr>

                {/* Column labels */}
                <tr className="bg-elevated border-b-2 border-border">
                  <th className="sticky left-0 z-10 bg-elevated text-left px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-[110px]">
                    Responsável
                  </th>
                  <th className="sticky left-[110px] z-10 bg-elevated text-left px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-[200px] border-r border-border">
                    Rede
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-foreground min-w-[120px] leading-tight">
                    Fat.<br />{mesLabel(selectedMes)}
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-[80px] border-r border-border/50">
                    % Invest.
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-foreground min-w-[120px] leading-tight">
                    Expect.<br />Investimento
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-foreground min-w-[120px] leading-tight">
                    Não<br />provisionado
                  </th>
                  <th className="text-right px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-[120px]">
                    Provisionado
                  </th>
                  <th className="text-center px-3 py-2 font-semibold min-w-[90px] leading-tight border-r border-border">
                    <span className="text-orange-400">Ações</span><br />
                    <span className="text-orange-400">Atrasadas</span>
                  </th>

                  {/* ── Toggle button cell ── */}
                  <th className="px-2 py-2 text-center whitespace-nowrap w-8">
                    <button
                      onClick={() => setShowPastMonths((p) => !p)}
                      title={showPastMonths ? "Mostrar meses futuros" : "Mostrar meses anteriores"}
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-[11px] font-bold transition-all ${
                        showPastMonths
                          ? "bg-sky-500/20 border-sky-500/40 text-sky-400 hover:bg-sky-500/30"
                          : "bg-foreground/8 border-border text-muted hover:bg-foreground/15 hover:text-foreground"
                      }`}
                    >
                      {showPastMonths ? "›" : "‹"}
                    </button>
                  </th>

                  {/* Month columns */}
                  {MONTHS.map((m) => (
                    <th
                      key={m.key}
                      className="text-right px-3 py-2 font-semibold text-foreground whitespace-nowrap min-w-[100px]"
                    >
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* ── TBODY ────────────────────────────────────────────────── */}
              <tbody>
                {filteredGrupos.map((grupo) => {
                  const isExpanded = expandedGerentes.has(grupo.gerente);
                  return (
                    <React.Fragment key={grupo.gerente}>
                      {/* Individual client rows */}
                      {isExpanded &&
                        grupo.clientes.map((c) => (
                          <tr
                            key={`${grupo.gerente}__${c.rede}`}
                            className="border-b border-border hover:bg-foreground/3 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-background hover:bg-foreground/3 px-3 py-2 text-muted whitespace-nowrap">
                              {grupo.gerente}
                            </td>
                            <td className="sticky left-[110px] z-10 bg-background hover:bg-foreground/3 px-3 py-2 text-foreground whitespace-nowrap border-r border-border font-medium">
                              {c.rede}
                            </td>
                            {/* Fat. Mês */}
                            <td className="text-right px-3 py-2 text-foreground whitespace-nowrap">
                              {c.faturamento > 0 ? fmtCur(c.faturamento) : <span className="text-muted">-</span>}
                            </td>
                            {/* % Invest. */}
                            <td className="text-right px-3 py-2 whitespace-nowrap border-r border-border/50">
                              {c.percInvest != null ? (
                                <span className={percColor(c.percInvest)}>
                                  {c.percInvest.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            {/* Expect. Investimento */}
                            <td className="text-right px-3 py-2 whitespace-nowrap">
                              {c.expectativaInvest > 0 ? (
                                <span className="text-foreground font-medium">{fmtCur(c.expectativaInvest)}</span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            {/* Não provisionado */}
                            <td className="text-right px-3 py-2 whitespace-nowrap">
                              <CellAmber v={c.naoProvisionado} />
                            </td>
                            {/* Provisionado */}
                            <td className="text-right px-3 py-2 whitespace-nowrap">
                              <CellPos v={c.provisionado} />
                            </td>
                            {/* Ações Atrasadas */}
                            <td className="text-center px-3 py-2 whitespace-nowrap border-r border-border">
                              {c.acoesAtrasadas > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-[11px]">
                                  {c.acoesAtrasadas}
                                </span>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            {/* Toggle placeholder */}
                            <td className="px-2 py-2" />
                            {/* Month columns */}
                            {MONTHS.map((m) => (
                              <td key={m.key} className="text-right px-3 py-2 whitespace-nowrap">
                                <CellSky v={c.meses[m.key] || 0} />
                              </td>
                            ))}
                          </tr>
                        ))}

                      {/* Subtotal row */}
                      <tr
                        onClick={() => toggleGerente(grupo.gerente)}
                        className="cursor-pointer border-b-2 border-border bg-amber-500/8 hover:bg-amber-500/12 transition-colors"
                      >
                        <td
                          colSpan={2}
                          className="sticky left-0 z-10 bg-amber-500/10 hover:bg-amber-500/15 px-3 py-2.5 font-bold text-amber-400 whitespace-nowrap"
                          style={{ minWidth: "310px" }}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <Users className="w-3 h-3 shrink-0" />
                            <span>{grupo.gerente} Total</span>
                            {!isExpanded && (
                              <span className="text-[10px] text-amber-400/60 font-normal ml-1">
                                ({grupo.clientes.length} cliente{grupo.clientes.length !== 1 ? "s" : ""})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                          {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : <span className="text-muted font-normal">-</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold whitespace-nowrap border-r border-border/50">
                          {grupo.totals.percInvest != null ? (
                            <span className={percColor(grupo.totals.percInvest)}>
                              {grupo.totals.percInvest.toFixed(1)}%
                            </span>
                          ) : <span className="text-muted font-normal">-</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold text-foreground whitespace-nowrap">
                          {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : <span className="text-muted font-normal">-</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold text-amber-400 whitespace-nowrap">
                          {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : <span className="text-muted font-normal">-</span>}
                        </td>
                        <td className="text-right px-3 py-2.5 font-bold text-emerald-400 whitespace-nowrap">
                          {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : <span className="text-muted font-normal">-</span>}
                        </td>
                        {/* Ações Atrasadas subtotal */}
                        <td className="text-center px-3 py-2.5 whitespace-nowrap border-r border-border">
                          {grupo.totals.acoesAtrasadas > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/25 border border-orange-500/40 text-orange-400 font-bold text-[11px]">
                              {grupo.totals.acoesAtrasadas}
                            </span>
                          ) : (
                            <span className="text-muted font-normal">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5" />
                        {MONTHS.map((m) => (
                          <td key={m.key} className="text-right px-3 py-2.5 font-bold whitespace-nowrap">
                            {grupo.totals.meses[m.key] ? (
                              <span className="text-sky-400">{fmtCur(grupo.totals.meses[m.key])}</span>
                            ) : (
                              <span className="text-muted font-normal">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* ── Grand Total ────────────────────────────────────────── */}
                <tr className="bg-foreground/5 border-t-2 border-foreground/20">
                  <td
                    colSpan={2}
                    className="sticky left-0 z-10 bg-foreground/5 px-3 py-3 font-bold text-foreground whitespace-nowrap text-[11px] uppercase tracking-wide"
                    style={{ minWidth: "310px" }}
                  >
                    Total Geral
                  </td>
                  <td className="text-right px-3 py-3 font-bold text-foreground whitespace-nowrap text-[11px]">
                    {grandTotals.faturamento > 0 ? fmtCur(grandTotals.faturamento) : <span className="text-muted font-normal">-</span>}
                  </td>
                  <td className="text-right px-3 py-3 font-bold whitespace-nowrap text-[11px] border-r border-border/50">
                    {grandTotals.percInvest != null ? (
                      <span className={percColor(grandTotals.percInvest)}>
                        {grandTotals.percInvest.toFixed(1)}%
                      </span>
                    ) : <span className="text-muted font-normal">-</span>}
                  </td>
                  <td className="text-right px-3 py-3 font-bold text-foreground whitespace-nowrap text-[11px]">
                    {grandTotals.expectativaInvest > 0 ? fmtCur(grandTotals.expectativaInvest) : <span className="text-muted font-normal">-</span>}
                  </td>
                  <td className="text-right px-3 py-3 font-bold text-amber-400 whitespace-nowrap text-[11px]">
                    {grandTotals.naoProvisionado > 0 ? fmtCur(grandTotals.naoProvisionado) : <span className="text-muted font-normal">-</span>}
                  </td>
                  <td className="text-right px-3 py-3 font-bold text-emerald-400 whitespace-nowrap text-[11px]">
                    {grandTotals.provisionado > 0 ? fmtCur(grandTotals.provisionado) : <span className="text-muted font-normal">-</span>}
                  </td>
                  {/* Ações Atrasadas grand total */}
                  <td className="text-center px-3 py-3 whitespace-nowrap border-r border-border text-[11px]">
                    {grandTotals.acoesAtrasadas > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/25 border border-orange-500/40 text-orange-400 font-bold text-[11px]">
                        {grandTotals.acoesAtrasadas}
                      </span>
                    ) : (
                      <span className="text-muted font-normal">-</span>
                    )}
                  </td>
                  <td className="px-2 py-3" />
                  {MONTHS.map((m) => (
                    <td key={m.key} className="text-right px-3 py-3 font-bold whitespace-nowrap text-[11px]">
                      {grandTotals.meses[m.key] ? (
                        <span className="text-sky-400">{fmtCur(grandTotals.meses[m.key])}</span>
                      ) : (
                        <span className="text-muted font-normal">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Mobile: 3 blocos verticais ──────────────────────────────── */}
          <div className="lg:hidden space-y-4">

            {/* ── BLOCO 1: Faturamento ─────────────────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-elevated px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted border-b border-border">
                Faturamento
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-elevated border-b-2 border-border">
                      <th className="sticky left-0 z-10 bg-elevated text-left px-2 py-1.5 font-semibold text-foreground whitespace-nowrap w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                        Rede
                      </th>
                      <th className="text-right px-2 py-1.5 font-semibold text-foreground min-w-[100px] leading-tight">
                        Fat.<br />{mesLabel(selectedMes)}
                      </th>
                      <th className="text-right px-2 py-1.5 font-semibold text-foreground whitespace-nowrap min-w-[80px]">
                        % Invest.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrupos.map((grupo) => {
                      const isExpanded = expandedGerentes.has(grupo.gerente);
                      return (
                        <React.Fragment key={`m1-${grupo.gerente}`}>
                          {/* Gerente label row */}
                          <tr className="bg-amber-500/5 border-b border-amber-500/20">
                            <td colSpan={3} className="px-2 py-1 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wide">
                              {grupo.gerente}
                            </td>
                          </tr>
                          {isExpanded && grupo.clientes.map((c) => (
                            <tr key={`m1-${grupo.gerente}-${c.rede}`} className="border-b border-border hover:bg-foreground/3">
                              <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-foreground font-medium w-[88px] min-w-[88px] max-w-[88px] overflow-hidden truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                                {c.rede}
                              </td>
                              <td className="text-right px-2 py-1.5 text-foreground whitespace-nowrap">
                                {c.faturamento > 0 ? fmtCur(c.faturamento) : <span className="text-muted">-</span>}
                              </td>
                              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                                {c.percInvest != null ? (
                                  <span className={percColor(c.percInvest)}>{c.percInvest.toFixed(1)}%</span>
                                ) : <span className="text-muted">-</span>}
                              </td>
                            </tr>
                          ))}
                          {/* Subtotal */}
                          <tr
                            onClick={() => toggleGerente(grupo.gerente)}
                            className="cursor-pointer border-b-2 border-border bg-amber-500/10 hover:bg-amber-500/15"
                          >
                            <td className="sticky left-0 z-10 px-2 py-1.5 font-bold text-amber-400 w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(245,158,11,0.12)]">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                <span className="text-[11px]">{grupo.gerente} Total</span>
                              </div>
                            </td>
                            <td className="text-right px-2 py-1.5 font-bold text-foreground whitespace-nowrap">
                              {grupo.totals.faturamento > 0 ? fmtCur(grupo.totals.faturamento) : <span className="text-muted font-normal">-</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 font-bold whitespace-nowrap">
                              {grupo.totals.percInvest != null ? (
                                <span className={percColor(grupo.totals.percInvest)}>{grupo.totals.percInvest.toFixed(1)}%</span>
                              ) : <span className="text-muted font-normal">-</span>}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    {/* Grand total */}
                    <tr className="bg-foreground/5 border-t-2 border-foreground/20">
                      <td className="sticky left-0 z-10 bg-background px-2 py-1.5 font-bold text-foreground text-[11px] uppercase tracking-wide w-[88px] min-w-[88px] max-w-[88px] truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(0,0,0,0.04)]">
                        Total Geral
                      </td>
                      <td className="text-right px-3 py-3 font-bold text-foreground whitespace-nowrap text-[11px]">
                        {grandTotals.faturamento > 0 ? fmtCur(grandTotals.faturamento) : <span className="text-muted font-normal">-</span>}
                      </td>
                      <td className="text-right px-3 py-3 font-bold whitespace-nowrap text-[11px]">
                        {grandTotals.percInvest != null ? (
                          <span className={percColor(grandTotals.percInvest)}>{grandTotals.percInvest.toFixed(1)}%</span>
                        ) : <span className="text-muted font-normal">-</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── BLOCO 2: Valores ─────────────────────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-elevated px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-widest text-muted border-b border-border">
                Valores · {mesLabel(selectedMes)}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-elevated border-b-2 border-border">
                      <th className="sticky left-0 z-10 bg-elevated text-left px-2 py-1.5 font-semibold text-foreground whitespace-nowrap w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                        Rede
                      </th>
                      <th className="text-right px-2 py-1.5 font-semibold text-foreground min-w-[100px] leading-tight">
                        Expect.<br />Invest.
                      </th>
                      <th className="text-right px-2 py-1.5 font-semibold text-foreground min-w-[90px] leading-tight">
                        Não<br />prov.
                      </th>
                      <th className="text-right px-2 py-1.5 font-semibold text-foreground whitespace-nowrap min-w-[90px]">
                        Prov.
                      </th>
                      <th className="text-center px-2 py-1.5 font-semibold min-w-[70px] leading-tight">
                        <span className="text-orange-400">Ações</span><br />
                        <span className="text-orange-400">Atras.</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrupos.map((grupo) => {
                      const isExpanded = expandedGerentes.has(grupo.gerente);
                      return (
                        <React.Fragment key={`m2-${grupo.gerente}`}>
                          <tr className="bg-amber-500/5 border-b border-amber-500/20">
                            <td colSpan={5} className="px-2 py-1 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wide">
                              {grupo.gerente}
                            </td>
                          </tr>
                          {isExpanded && grupo.clientes.map((c) => (
                            <tr key={`m2-${grupo.gerente}-${c.rede}`} className="border-b border-border hover:bg-foreground/3">
                              <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-foreground font-medium w-[88px] min-w-[88px] max-w-[88px] overflow-hidden truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                                {c.rede}
                              </td>
                              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                                {c.expectativaInvest > 0 ? <span className="font-medium">{fmtCur(c.expectativaInvest)}</span> : <span className="text-muted">-</span>}
                              </td>
                              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                                <CellAmber v={c.naoProvisionado} />
                              </td>
                              <td className="text-right px-2 py-1.5 whitespace-nowrap">
                                <CellPos v={c.provisionado} />
                              </td>
                              <td className="text-center px-2 py-1.5 whitespace-nowrap">
                                {c.acoesAtrasadas > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-bold text-[11px]">
                                    {c.acoesAtrasadas}
                                  </span>
                                ) : <span className="text-muted">-</span>}
                              </td>
                            </tr>
                          ))}
                          <tr
                            onClick={() => toggleGerente(grupo.gerente)}
                            className="cursor-pointer border-b-2 border-border bg-amber-500/10 hover:bg-amber-500/15"
                          >
                            <td className="sticky left-0 z-10 px-2 py-1.5 font-bold text-amber-400 w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(245,158,11,0.12)]">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                <span className="text-[11px]">{grupo.gerente} Total</span>
                              </div>
                            </td>
                            <td className="text-right px-2 py-1.5 font-bold text-foreground whitespace-nowrap">
                              {grupo.totals.expectativaInvest > 0 ? fmtCur(grupo.totals.expectativaInvest) : <span className="text-muted font-normal">-</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 font-bold text-amber-400 whitespace-nowrap">
                              {grupo.totals.naoProvisionado > 0 ? fmtCur(grupo.totals.naoProvisionado) : <span className="text-muted font-normal">-</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 font-bold text-emerald-400 whitespace-nowrap">
                              {grupo.totals.provisionado > 0 ? fmtCur(grupo.totals.provisionado) : <span className="text-muted font-normal">-</span>}
                            </td>
                            <td className="text-center px-2 py-1.5 whitespace-nowrap">
                              {grupo.totals.acoesAtrasadas > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/25 border border-orange-500/40 text-orange-400 font-bold text-[11px]">
                                  {grupo.totals.acoesAtrasadas}
                                </span>
                              ) : <span className="text-muted font-normal">-</span>}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    <tr className="bg-foreground/5 border-t-2 border-foreground/20">
                      <td className="sticky left-0 z-10 bg-background px-2 py-1.5 font-bold text-foreground text-[11px] uppercase tracking-wide w-[88px] min-w-[88px] max-w-[88px] truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(0,0,0,0.04)]">
                        Total Geral
                      </td>
                      <td className="text-right px-3 py-3 font-bold text-foreground whitespace-nowrap text-[11px]">
                        {grandTotals.expectativaInvest > 0 ? fmtCur(grandTotals.expectativaInvest) : <span className="text-muted font-normal">-</span>}
                      </td>
                      <td className="text-right px-3 py-3 font-bold text-amber-400 whitespace-nowrap text-[11px]">
                        {grandTotals.naoProvisionado > 0 ? fmtCur(grandTotals.naoProvisionado) : <span className="text-muted font-normal">-</span>}
                      </td>
                      <td className="text-right px-3 py-3 font-bold text-emerald-400 whitespace-nowrap text-[11px]">
                        {grandTotals.provisionado > 0 ? fmtCur(grandTotals.provisionado) : <span className="text-muted font-normal">-</span>}
                      </td>
                      <td className="text-center px-3 py-3 whitespace-nowrap text-[11px]">
                        {grandTotals.acoesAtrasadas > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-orange-500/25 border border-orange-500/40 text-orange-400 font-bold text-[11px]">
                            {grandTotals.acoesAtrasadas}
                          </span>
                        ) : <span className="text-muted font-normal">-</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── BLOCO 3: Provisionado por mês ───────────────────────── */}
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="bg-elevated px-2 py-1.5 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Provisionado por Mês
                  </span>
                  <button
                    onClick={() => setShowPastMonths((p) => !p)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all ${
                      showPastMonths
                        ? "bg-sky-500/20 border-sky-500/40 text-sky-400"
                        : "bg-foreground/8 border-border text-muted"
                    }`}
                  >
                    {showPastMonths ? "›" : "‹"}
                    <span className="text-[10px] font-normal">
                      {showPastMonths ? "Futuros" : "Anteriores"}
                    </span>
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-elevated border-b-2 border-border">
                      <th className="sticky left-0 z-10 bg-elevated text-left px-2 py-1.5 font-semibold text-foreground whitespace-nowrap w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.08)]">
                        Rede
                      </th>
                      {MONTHS.map((m) => (
                        <th key={m.key} className="text-right px-2 py-1.5 font-semibold text-foreground whitespace-nowrap min-w-[90px]">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrupos.map((grupo) => {
                      const isExpanded = expandedGerentes.has(grupo.gerente);
                      return (
                        <React.Fragment key={`m3-${grupo.gerente}`}>
                          <tr className="bg-amber-500/5 border-b border-amber-500/20">
                            <td colSpan={1 + MONTHS.length} className="px-2 py-1 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wide">
                              {grupo.gerente}
                            </td>
                          </tr>
                          {isExpanded && grupo.clientes.map((c) => (
                            <tr key={`m3-${grupo.gerente}-${c.rede}`} className="border-b border-border hover:bg-foreground/3">
                              <td className="sticky left-0 z-10 bg-background px-2 py-1.5 text-foreground font-medium w-[88px] min-w-[88px] max-w-[88px] overflow-hidden truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                                {c.rede}
                              </td>
                              {MONTHS.map((m) => (
                                <td key={m.key} className="text-right px-2 py-1.5 whitespace-nowrap">
                                  <CellSky v={c.meses[m.key] || 0} />
                                </td>
                              ))}
                            </tr>
                          ))}
                          <tr
                            onClick={() => toggleGerente(grupo.gerente)}
                            className="cursor-pointer border-b-2 border-border bg-amber-500/10 hover:bg-amber-500/15"
                          >
                            <td className="sticky left-0 z-10 px-2 py-1.5 font-bold text-amber-400 w-[88px] min-w-[88px] max-w-[88px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(245,158,11,0.12)]">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                <span className="text-[11px]">{grupo.gerente} Total</span>
                              </div>
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m.key} className="text-right px-2 py-1.5 font-bold whitespace-nowrap">
                                {grupo.totals.meses[m.key] ? (
                                  <span className="text-sky-400">{fmtCur(grupo.totals.meses[m.key])}</span>
                                ) : <span className="text-muted font-normal">-</span>}
                              </td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                    <tr className="bg-foreground/5 border-t-2 border-foreground/20">
                      <td className="sticky left-0 z-10 bg-background px-2 py-1.5 font-bold text-foreground text-[11px] uppercase tracking-wide w-[88px] min-w-[88px] max-w-[88px] truncate shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06),inset_0_0_0_9999px_rgba(0,0,0,0.04)]">
                        Total Geral
                      </td>
                      {MONTHS.map((m) => (
                        <td key={m.key} className="text-right px-3 py-3 font-bold whitespace-nowrap text-[11px]">
                          {grandTotals.meses[m.key] ? (
                            <span className="text-sky-400">{fmtCur(grandTotals.meses[m.key])}</span>
                          ) : <span className="text-muted font-normal">-</span>}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>{/* end mobile */}
          </>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-foreground/20 border border-foreground/30" />
            <span>Expect. Investimento = valor × volume · mes_referencia = mês selecionado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-amber-500/30 border border-amber-500/40" />
            <span>Não provisionado = ação sem boleto no mês selecionado (qualquer fase)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/40" />
            <span>Provisionado = ação com boleto vinculado no mês selecionado (independe do vencimento)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-sky-500/30 border border-sky-500/40" />
            <span>Colunas de mês = provisionado por vencimento (‹/› para alternar passado/futuro)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-orange-500/30 border border-orange-500/40" />
            <span>Ações Atrasadas = fase 3 (Apur. GRV) com data_fim ≤ hoje - 7 dias</span>
          </div>
          <span className="ml-auto">Fonte: cm_acoes_investimento · Ações não pagas</span>
        </div>
      </div>
    </div>
  );
}
