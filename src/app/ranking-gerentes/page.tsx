"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Activity,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Loader2,
  DollarSign,
  Target,
  BarChart3,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Search,
} from "lucide-react";
import { formatCurrency, formatCompact } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { CommercialDomainService } from "@/lib/domain";
import { ManagerDrawer } from "./components/ManagerDrawer";
import type {
  ManagerRankingEntry,
  PerformanceStatus,
  PerformanceTrend,
  DataQuality,
} from "@/lib/services/manager-performance-score-service";

/* ───────────────── Types ───────────────── */

interface RankingApiResponse {
  success: boolean;
  error?: string;
  data?: {
    ranking: ManagerRankingEntry[];
    periodo: {
      rollingStart: string;
      rollingEnd: string;
      rollingAntStart: string;
      rollingAntEnd: string;
      mesReferencia: string;
    } | null;
    meta: {
      totalGerentes: number;
    };
  };
}

/* ───────────────── Badge Helpers ───────────────── */

const STATUS_CONFIG: Record<PerformanceStatus, { label: string; className: string }> = {
  TOP_PERFORMER: { label: "Top Performer", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  CONSISTENTE: { label: "Consistente", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  ATENCAO: { label: "Atenção", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  CRITICO: { label: "Crítico", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

const TREND_CONFIG: Record<PerformanceTrend, { label: string; icon: typeof TrendingUp; className: string }> = {
  EM_EVOLUCAO: { label: "Em Evolução", icon: TrendingUp, className: "text-emerald-400" },
  ESTAVEL: { label: "Estável", icon: Minus, className: "text-muted" },
  EM_QUEDA: { label: "Em Queda", icon: TrendingDown, className: "text-rose-400" },
};

const DATA_QUALITY_CONFIG: Record<DataQuality, { label: string; className: string } | null> = {
  COMPLETO: null, // Não exibir badge
  CARTEIRA_REDUZIDA: { label: "Carteira Reduzida", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  AVALIACAO: { label: "Em Avaliação", className: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  SEM_DADOS: { label: "Sem Dados", className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
};

function formatMonth(monthStr: string): string {
  const MONTH_NAMES: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[month] || month}/${year}`;
}

function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
    score >= 60 ? "text-blue-400 border-blue-500/40 bg-blue-500/10" :
    score >= 40 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
    "text-rose-400 border-rose-500/40 bg-rose-500/10";

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1 font-bold";
  return (
    <span className={`inline-flex items-center rounded-lg border ${color} ${sizeClass} tabular-nums`}>
      {score}
    </span>
  );
}

/* ───────────────── Main Page ───────────────── */

export default function RankingGerentesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<ManagerRankingEntry[]>([]);
  const [periodo, setPeriodo] = useState<{
    rollingStart: string;
    rollingEnd: string;
    rollingAntStart: string;
    rollingAntEnd: string;
    mesReferencia: string;
  } | null>(null);

  // Filters from CommercialDomainService (SSOT)
  const fieldManagers = useMemo(() => CommercialDomainService.getFieldManagerList(), []);
  const [filterManager, setFilterManager] = useState("all");
  const [filterUf, setFilterUf] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [selectedEntry, setSelectedEntry] = useState<ManagerRankingEntry | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterManager !== "all") params.set("manager", filterManager);
      if (filterUf !== "all") params.set("uf", filterUf);
      if (filterChannel !== "all") params.set("channel", filterChannel);

      const res = await fetch(`/api/ranking-gerentes?${params.toString()}`, { cache: "no-store" });
      const json: RankingApiResponse = await res.json();

      if (json.success && json.data) {
        setRanking(json.data.ranking);
        setPeriodo(json.data.periodo);
      } else {
        setError(json.error || "Erro ao carregar ranking de gerentes.");
      }
    } catch (err: any) {
      console.error("Erro no Ranking de Gerentes:", err);
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filterManager, filterUf, filterChannel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs derivados do mesmo dataset da Grid (zero cálculos adicionais)
  const kpis = useMemo(() => {
    if (ranking.length === 0) {
      return { fatTotal: 0, scoreMedio: 0, taxaAtivacaoMedia: 0, emEvolucao: 0, emQueda: 0 };
    }
    const fatTotal = ranking.reduce((acc, r) => acc + r.rollingFat3m, 0);
    const scoreMedio = Math.round(ranking.reduce((acc, r) => acc + r.scorePerformance, 0) / ranking.length);
    const taxaAtivacaoMedia = Number((ranking.reduce((acc, r) => acc + r.taxaAtivacao, 0) / ranking.length).toFixed(1));
    const emEvolucao = ranking.filter((r) => r.tendencia === "EM_EVOLUCAO").length;
    const emQueda = ranking.filter((r) => r.tendencia === "EM_QUEDA").length;
    return { fatTotal, scoreMedio, taxaAtivacaoMedia, emEvolucao, emQueda };
  }, [ranking]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ═══ HEADER ═══ */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-muted mb-1">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-semibold">Ranking de Performance</span>
            </nav>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground tracking-tight">
                  Ranking de Performance
                </h1>
                <p className="text-xs text-muted">
                  Performance dos Gerentes de Campo
                  {periodo && (
                    <span className="ml-1.5 text-amber-400 font-semibold">
                      — Rolling 3M: {formatMonth(periodo.rollingStart)} → {formatMonth(periodo.rollingEnd)}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="w-3 h-3" /> Analytics Engine V1
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-muted/20 hover:bg-muted/30 text-muted transition-colors"
              title="Atualizar Dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── FILTER BAR ── */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider mr-1">Filtros</span>

            {/* Manager filter */}
            <select
              value={filterManager}
              onChange={(e) => setFilterManager(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500 min-w-[140px]"
            >
              <option value="all">Todos os Gerentes</option>
              {fieldManagers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* UF filter */}
            <select
              value={filterUf}
              onChange={(e) => setFilterUf(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500 min-w-[100px]"
            >
              <option value="all">Todas UFs</option>
              {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>

            {/* Channel filter */}
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500 min-w-[120px]"
            >
              <option value="all">Todos os Canais</option>
              <option value="KA">KA</option>
              <option value="Distribuidor">Distribuidor</option>
            </select>

            {/* Clear filters */}
            {(filterManager !== "all" || filterUf !== "all" || filterChannel !== "all") && (
              <button
                onClick={() => { setFilterManager("all"); setFilterUf("all"); setFilterChannel("all"); }}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors ml-auto"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {loading ? (
          /* ── LOADING STATE ── */
          <div className="space-y-6">
            {/* KPI Skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card p-4 space-y-3 animate-pulse">
                  <div className="h-3 w-24 bg-muted/20 rounded" />
                  <div className="h-7 w-32 bg-muted/20 rounded" />
                  <div className="h-2 w-full bg-muted/10 rounded" />
                </div>
              ))}
            </div>
            {/* Table Skeleton */}
            <div className="glass-card p-5 animate-pulse space-y-3">
              <div className="h-4 w-48 bg-muted/20 rounded" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 w-full bg-muted/10 rounded" />
              ))}
            </div>
          </div>
        ) : error ? (
          /* ── ERROR STATE ── */
          <div className="glass-card p-8 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 mx-auto text-rose-400" />
            <p className="text-sm font-semibold text-rose-400">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-semibold hover:bg-rose-500/20 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        ) : ranking.length === 0 ? (
          /* ── EMPTY STATE ── */
          <div className="glass-card p-8 text-center space-y-3">
            <Search className="w-10 h-10 mx-auto text-muted/40" />
            <p className="text-sm font-semibold text-muted">
              Nenhum gerente encontrado para os filtros selecionados.
            </p>
            <p className="text-xs text-muted/60">
              Ajuste os filtros ou verifique o período de referência.
            </p>
          </div>
        ) : (
          <>
            {/* ═══ KPI CARDS ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* KPI 1: Faturamento Total Rolling 3M */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">FAT Rolling 3M</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCompact(kpis.fatTotal)}
                </div>
                <div className="text-xs text-muted pt-1 border-t border-border/50">
                  Consolidado — {ranking.length} gerente{ranking.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* KPI 2: Score Médio */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Score Médio</span>
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex items-baseline gap-2">
                  <ScoreBadge score={kpis.scoreMedio} />
                  <span className="text-xs text-muted">/ 100</span>
                </div>
                <div className="text-xs text-muted pt-1 border-t border-border/50">
                  Performance média da equipe
                </div>
              </div>

              {/* KPI 3: Taxa Média de Ativação */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Ativação Média</span>
                  <Activity className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {kpis.taxaAtivacaoMedia}%
                </div>
                <div className="text-xs text-muted pt-1 border-t border-border/50">
                  Clientes ativos / total cadastrados
                </div>
              </div>

              {/* KPI 4: Evolução / Queda */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Tendência Equipe</span>
                  <BarChart3 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    <span className="text-lg font-bold text-emerald-400">{kpis.emEvolucao}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    <span className="text-lg font-bold text-rose-400">{kpis.emQueda}</span>
                  </div>
                </div>
                <div className="text-xs text-muted pt-1 border-t border-border/50">
                  Em evolução / Em queda (variação ≥ 10%)
                </div>
              </div>
            </div>

            {/* ═══ RANKING GRID ═══ */}
            <div className="glass-card p-0 overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Ranking de Performance
                  </h2>
                </div>
                <span className="text-[11px] text-muted font-medium">
                  Ordenado por Score de Performance
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/5 border-b border-border">
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider w-10">#</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider min-w-[140px]">Gerente</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">FAT 3M</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Variação</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Ativos</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Sem Compra</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Ativação</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Freq.</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Score</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Tendência</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((entry) => {
                      const trendCfg = TREND_CONFIG[entry.tendencia];
                      const statusCfg = STATUS_CONFIG[entry.status];
                      const dqCfg = DATA_QUALITY_CONFIG[entry.dataQuality];
                      const TrendIcon = trendCfg.icon;

                      return (
                        <tr
                          key={entry.managerId}
                          className="border-b border-border/50 hover:bg-muted/5 transition-colors cursor-pointer"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          {/* Position */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                              entry.position === 1 ? "bg-amber-500/20 text-amber-400" :
                              entry.position === 2 ? "bg-zinc-400/20 text-zinc-300" :
                              entry.position === 3 ? "bg-orange-600/20 text-orange-400" :
                              "bg-muted/10 text-muted"
                            }`}>
                              {entry.position}
                            </span>
                          </td>

                          {/* Manager Name */}
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-semibold text-foreground text-sm">{entry.managerName}</span>
                              {dqCfg && (
                                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${dqCfg.className}`}>
                                  {dqCfg.label}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* FAT Rolling 3M */}
                          <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                            {formatCompact(entry.rollingFat3m)}
                          </td>

                          {/* Variação % */}
                          <td className="px-4 py-3 text-right tabular-nums">
                            {entry.variacaoPct !== null ? (
                              <span className={`font-semibold ${
                                entry.variacaoPct > 0 ? "text-emerald-400" :
                                entry.variacaoPct < 0 ? "text-rose-400" :
                                "text-muted"
                              }`}>
                                {entry.variacaoPct > 0 ? "+" : ""}{entry.variacaoPct}%
                              </span>
                            ) : (
                              <span className="text-muted">N/D</span>
                            )}
                          </td>

                          {/* Clientes Ativos */}
                          <td className="px-4 py-3 text-center font-semibold text-foreground tabular-nums">
                            {entry.clientesAtivos}
                          </td>

                          {/* Clientes Sem Compra */}
                          <td className="px-4 py-3 text-center tabular-nums">
                            <span className={entry.clientesSemCompra > 0 ? "text-amber-400 font-semibold" : "text-muted"}>
                              {entry.clientesSemCompra}
                            </span>
                          </td>

                          {/* Taxa de Ativação */}
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className={`font-semibold ${
                              entry.taxaAtivacao >= 80 ? "text-emerald-400" :
                              entry.taxaAtivacao >= 60 ? "text-blue-400" :
                              entry.taxaAtivacao >= 40 ? "text-amber-400" :
                              "text-rose-400"
                            }`}>
                              {entry.taxaAtivacao}%
                            </span>
                          </td>

                          {/* Frequência */}
                          <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                            {entry.frequenciaMedia}
                          </td>

                          {/* Score */}
                          <td className="px-4 py-3 text-center">
                            <ScoreBadge score={entry.scorePerformance} size="sm" />
                          </td>

                          {/* Tendência */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${trendCfg.className}`}>
                              <TrendIcon className="w-3.5 h-3.5" />
                              <span className="hidden xl:inline">{trendCfg.label}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.className}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-[11px] text-muted">
                <span>{ranking.length} gerente{ranking.length !== 1 ? "s" : ""} de campo</span>
                {periodo && (
                  <span>
                    Período anterior: {formatMonth(periodo.rollingAntStart)} → {formatMonth(periodo.rollingAntEnd)}
                  </span>
                )}
              </div>
            </div>

            {/* ═══ SCORE EXPLANATION ═══ */}
            <div className="glass-card p-4">
              <details className="group">
                <summary className="cursor-pointer flex items-center gap-2 text-xs font-semibold text-muted hover:text-foreground transition-colors">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  Como o Score de Performance é calculado?
                </summary>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-3 text-[11px] text-muted">
                  <div className="p-2.5 rounded-lg bg-muted/5 border border-border/50">
                    <div className="font-bold text-foreground mb-0.5">Resultado Financeiro</div>
                    <div className="text-amber-400 font-semibold">35%</div>
                    <div className="mt-1">Faturamento per capita normalizado pela equipe</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/5 border border-border/50">
                    <div className="font-bold text-foreground mb-0.5">Crescimento</div>
                    <div className="text-amber-400 font-semibold">25%</div>
                    <div className="mt-1">Variação Rolling 3M vs. período anterior</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/5 border border-border/50">
                    <div className="font-bold text-foreground mb-0.5">Saúde da Carteira</div>
                    <div className="text-amber-400 font-semibold">20%</div>
                    <div className="mt-1">Taxa de ativação de clientes</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/5 border border-border/50">
                    <div className="font-bold text-foreground mb-0.5">Frequência</div>
                    <div className="text-amber-400 font-semibold">10%</div>
                    <div className="mt-1">Regularidade de compras dos clientes</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/5 border border-border/50">
                    <div className="font-bold text-foreground mb-0.5">Consistência</div>
                    <div className="text-amber-400 font-semibold">10%</div>
                    <div className="mt-1">Estabilidade mensal de resultado</div>
                  </div>
                </div>
              </details>
            </div>
          </>
        )}
      </main>

      {/* ═══ DRAWER ═══ */}
      {selectedEntry && (
        <ManagerDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
