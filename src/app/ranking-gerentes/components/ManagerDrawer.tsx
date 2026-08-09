"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Activity,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Users,
  DollarSign,
  BarChart3,
  RefreshCw,
  Lightbulb,
  ClipboardList,
} from "lucide-react";
import { formatCompact, formatCurrency } from "@/lib/formatters";
import type {
  ManagerRankingEntry,
  PerformanceStatus,
  PerformanceTrend,
} from "@/lib/services/manager-performance-score-service";
import type { ManagerPerformanceDetailData } from "@/lib/governance/analytics/engine";

/* ───────────────── Types ───────────────── */

interface ManagerDrawerProps {
  entry: ManagerRankingEntry;
  onClose: () => void;
}

interface DetailApiResponse {
  success: boolean;
  error?: string;
  data?: ManagerPerformanceDetailData & {
    periodo: { rollingStart: string; rollingEnd: string };
  };
}

/* ───────────────── Badge Configs (render-only) ───────────────── */

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

const SCORE_DIMENSIONS = [
  { key: "scoreFinanceiro" as const, label: "Resultado Financeiro", peso: "35%", color: "text-emerald-400" },
  { key: "scoreCrescimento" as const, label: "Crescimento", peso: "25%", color: "text-blue-400" },
  { key: "scoreCarteira" as const, label: "Saúde da Carteira", peso: "20%", color: "text-amber-400" },
  { key: "scoreFrequencia" as const, label: "Frequência", peso: "10%", color: "text-purple-400" },
  { key: "scoreConsistencia" as const, label: "Consistência", peso: "10%", color: "text-cyan-400" },
];

/* ───────────────── Action suggestions mapping (presentation-only) ───────────────── */

function getActionSuggestions(entry: ManagerRankingEntry): { icon: typeof Target; text: string; priority: string }[] {
  const suggestions: { icon: typeof Target; text: string; priority: string }[] = [];

  if (entry.status === "CRITICO") {
    suggestions.push({ icon: AlertTriangle, text: "Ação urgente: revisar estratégia comercial e plano de ativação da carteira", priority: "Alta" });
  }
  if (entry.status === "ATENCAO") {
    suggestions.push({ icon: Target, text: "Acompanhar de perto a evolução dos indicadores nas próximas semanas", priority: "Média" });
  }
  if (entry.clientesSemCompra > 0) {
    suggestions.push({ icon: Users, text: `Recuperar ${entry.clientesSemCompra} cliente${entry.clientesSemCompra > 1 ? "s" : ""} sem compra no período`, priority: entry.clientesSemCompra > 5 ? "Alta" : "Média" });
  }
  if (entry.taxaAtivacao < 60) {
    suggestions.push({ icon: Activity, text: "Expandir base ativa — taxa de ativação abaixo de 60%", priority: "Alta" });
  }
  if (entry.concentracaoTop3 > 70) {
    suggestions.push({ icon: BarChart3, text: `Reduzir concentração (${entry.concentracaoTop3}% nos Top 3) — diversificar carteira`, priority: "Média" });
  }
  if (entry.frequenciaMedia < 1.5) {
    suggestions.push({ icon: RefreshCw, text: "Aumentar frequência de compras — média abaixo de 1,5x/mês", priority: "Média" });
  }
  if (entry.tendencia === "EM_QUEDA") {
    suggestions.push({ icon: TrendingDown, text: "Investigar causas da queda e definir plano de recuperação", priority: "Alta" });
  }
  if (entry.tendencia === "EM_EVOLUCAO") {
    suggestions.push({ icon: TrendingUp, text: "Manter ritmo — gerente em evolução consistente", priority: "Baixa" });
  }

  return suggestions.length > 0 ? suggestions : [{ icon: Lightbulb, text: "Sem ações prioritárias no momento — manter acompanhamento regular", priority: "Baixa" }];
}

/* ───────────────── Helpers ───────────────── */

function formatMonth(monthStr: string): string {
  const MONTH_NAMES: Record<string, string> = {
    "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
    "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
    "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
  };
  const [year, month] = monthStr.split("-");
  return `${MONTH_NAMES[month] || month}/${year?.slice(2)}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" :
    score >= 60 ? "text-blue-400 border-blue-500/40 bg-blue-500/10" :
    score >= 40 ? "text-amber-400 border-amber-500/40 bg-amber-500/10" :
    "text-rose-400 border-rose-500/40 bg-rose-500/10";

  return (
    <span className={`inline-flex items-center rounded-lg border px-3 py-1 text-lg font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

/* ───────────────── Radar Chart (SVG) ───────────────── */

function RadarChart({ scores }: { scores: number[] }) {
  const size = 200;
  const center = size / 2;
  const maxRadius = 75;
  const levels = 4; // 25, 50, 75, 100

  const angleStep = (2 * Math.PI) / 5;
  const startAngle = -Math.PI / 2; // Start from top

  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  };

  // Grid polygons
  const gridPolygons = Array.from({ length: levels }, (_, level) => {
    const r = ((level + 1) / levels) * 100;
    const points = Array.from({ length: 5 }, (_, i) => {
      const p = getPoint(i, r);
      return `${p.x},${p.y}`;
    }).join(" ");
    return points;
  });

  // Data polygon
  const dataPoints = scores.map((s, i) => {
    const p = getPoint(i, s);
    return `${p.x},${p.y}`;
  }).join(" ");

  // Labels
  const labels = ["Financeiro", "Crescimento", "Carteira", "Frequência", "Consistência"];
  const labelPositions = labels.map((_, i) => {
    const p = getPoint(i, 115); // Slightly outside
    return p;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto">
      {/* Grid */}
      {gridPolygons.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-border/50"
        />
      ))}

      {/* Axes */}
      {Array.from({ length: 5 }, (_, i) => {
        const p = getPoint(i, 100);
        return (
          <line
            key={i}
            x1={center} y1={center}
            x2={p.x} y2={p.y}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border/30"
          />
        );
      })}

      {/* Data area */}
      <polygon
        points={dataPoints}
        fill="rgba(245, 158, 11, 0.15)"
        stroke="rgb(245, 158, 11)"
        strokeWidth="1.5"
      />

      {/* Data points */}
      {scores.map((s, i) => {
        const p = getPoint(i, s);
        return (
          <circle
            key={i}
            cx={p.x} cy={p.y} r="3"
            fill="rgb(245, 158, 11)"
          />
        );
      })}

      {/* Labels */}
      {labelPositions.map((pos, i) => (
        <text
          key={i}
          x={pos.x} y={pos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted text-[7px]"
        >
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

/* ───────────────── Bar Chart (simple) ───────────────── */

function EvolutionChart({ data }: { data: { mes: string; fat: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-muted text-center py-4">Sem dados de evolução.</p>;

  const maxFat = Math.max(...data.map(d => d.fat), 1);

  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d) => {
        const heightPct = Math.max((d.fat / maxFat) * 100, 4);
        return (
          <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[9px] text-muted tabular-nums">{formatCompact(d.fat)}</span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-amber-500/60 to-amber-400/80 transition-all"
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[8px] text-muted font-medium">{formatMonth(d.mes)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────── Main Drawer ───────────────── */

export function ManagerDrawer({ entry, onClose }: ManagerDrawerProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<DetailApiResponse["data"]>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/ranking-gerentes/${encodeURIComponent(entry.managerId)}`, { cache: "no-store" });
      const json: DetailApiResponse = await res.json();
      if (json.success && json.data) {
        setDetail(json.data);
      } else {
        setError(json.error || "Erro ao carregar detalhes do gerente.");
      }
    } catch (err: any) {
      console.error("Erro no detalhe do gerente:", err);
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [entry.managerId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const statusCfg = STATUS_CONFIG[entry.status];
  const trendCfg = TREND_CONFIG[entry.tendencia];
  const TrendIcon = trendCfg.icon;
  const actionSuggestions = getActionSuggestions(entry);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] md:w-[580px] bg-background border-l border-border z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">

        {/* ═══ HEADER ═══ */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Position Badge */}
              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                entry.position === 1 ? "bg-amber-500/20 text-amber-400" :
                entry.position === 2 ? "bg-zinc-400/20 text-zinc-300" :
                entry.position === 3 ? "bg-orange-600/20 text-orange-400" :
                "bg-muted/10 text-muted"
              }`}>
                {entry.position}º
              </span>
              <div>
                <h2 className="text-lg font-black text-foreground">{entry.managerName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${trendCfg.className}`}>
                    <TrendIcon className="w-3 h-3" />
                    {trendCfg.label}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors text-muted hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">

          {/* ═══ RESUMO EXECUTIVO ═══ */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/5 border border-border/50 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Score</div>
              <ScoreBadge score={entry.scorePerformance} />
              <div className="text-[10px] text-muted mt-1">/ 100</div>
            </div>
            <div className="bg-muted/5 border border-border/50 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">FAT 3M</div>
              <div className="text-lg font-bold text-foreground">{formatCompact(entry.rollingFat3m)}</div>
              {entry.variacaoPct !== null && (
                <div className={`text-[10px] font-semibold ${entry.variacaoPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {entry.variacaoPct > 0 ? "+" : ""}{entry.variacaoPct}%
                </div>
              )}
            </div>
            <div className="bg-muted/5 border border-border/50 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">Ativação</div>
              <div className={`text-lg font-bold ${
                entry.taxaAtivacao >= 80 ? "text-emerald-400" :
                entry.taxaAtivacao >= 60 ? "text-blue-400" :
                entry.taxaAtivacao >= 40 ? "text-amber-400" :
                "text-rose-400"
              }`}>{entry.taxaAtivacao}%</div>
              <div className="text-[10px] text-muted">{entry.clientesAtivos} ativos</div>
            </div>
          </div>

          {/* ═══ RADAR DE SCORE ═══ */}
          <section className="bg-muted/5 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Radar de Performance</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <RadarChart
                scores={[
                  entry.scoreFinanceiro,
                  entry.scoreCrescimento,
                  entry.scoreCarteira,
                  entry.scoreFrequencia,
                  entry.scoreConsistencia,
                ]}
              />
              <div className="flex-1 space-y-1.5 w-full">
                {SCORE_DIMENSIONS.map((dim) => (
                  <div key={dim.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${dim.color} bg-current`} />
                      <span className="text-muted">{dim.label}</span>
                      <span className="text-muted/50 text-[10px]">({dim.peso})</span>
                    </div>
                    <span className="font-bold text-foreground tabular-nums">{entry[dim.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ═══ DETAIL SECTIONS (from API) ═══ */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
              <span className="text-[11px] text-muted font-semibold uppercase tracking-widest animate-pulse">
                Carregando detalhamento...
              </span>
            </div>
          ) : error ? (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 mx-auto text-rose-400" />
              <p className="text-xs font-semibold text-rose-400">{error}</p>
              <button
                onClick={fetchDetail}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-semibold hover:bg-rose-500/20 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : detail ? (
            <>
              {/* ═══ EVOLUÇÃO MENSAL ═══ */}
              <section className="bg-muted/5 border border-border/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Evolução Mensal (Rolling 3M)</h3>
                </div>
                <EvolutionChart data={detail.evolucaoMensal} />
              </section>

              {/* ═══ TOP 10 CLIENTES ═══ */}
              <section className="bg-muted/5 border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Top 10 Clientes</h3>
                  </div>
                  <span className="text-[10px] text-muted">Rolling 3M</span>
                </div>
                {detail.topClientes.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">Sem dados de clientes no período.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.topClientes.map((c) => (
                      <div key={`${c.posicao}-${c.nome}`} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                        <span className="w-5 text-center text-[10px] font-bold text-muted">{c.posicao}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">{c.nome}</div>
                          <div className="text-[10px] text-muted truncate">{c.rede}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground tabular-nums">{formatCompact(c.fat)}</div>
                          <div className="text-[10px] text-muted tabular-nums">{c.participacaoPct}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ═══ CLIENTES SEM COMPRA ═══ */}
              <section className="bg-muted/5 border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Clientes Sem Compra</h3>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">{detail.clientesSemCompra.length}</span>
                </div>
                {detail.clientesSemCompra.length === 0 ? (
                  <p className="text-xs text-emerald-400 text-center py-3">Todos os clientes compraram no período ✓</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {detail.clientesSemCompra.map((c, i) => (
                      <div key={`${i}-${c.nome}`} className="flex items-center gap-2 text-xs py-1 border-b border-border/30 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">{c.nome}</div>
                          <div className="text-[10px] text-muted truncate">{c.rede}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {c.diasSemCompra > 0 && (
                            <div className={`font-semibold tabular-nums ${c.diasSemCompra > 60 ? "text-rose-400" : c.diasSemCompra > 30 ? "text-amber-400" : "text-muted"}`}>
                              {c.diasSemCompra}d
                            </div>
                          )}
                          {c.faturado12m > 0 && (
                            <div className="text-[10px] text-muted tabular-nums">{formatCompact(c.faturado12m)} /12m</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ═══ CONCENTRAÇÃO TOP 3 ═══ */}
              <section className="bg-muted/5 border border-border/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Concentração Top 3</h3>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${
                    entry.concentracaoTop3 > 70 ? "text-amber-400" : "text-emerald-400"
                  }`}>{entry.concentracaoTop3}%</span>
                </div>
                {detail.concentracaoTop3.length === 0 ? (
                  <p className="text-xs text-muted text-center py-3">Sem dados de concentração.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.concentracaoTop3.map((c) => (
                      <div key={`top3-${c.posicao}`} className="flex items-center gap-2">
                        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                          c.posicao === 1 ? "bg-amber-500/20 text-amber-400" :
                          c.posicao === 2 ? "bg-zinc-400/20 text-zinc-300" :
                          "bg-orange-600/20 text-orange-400"
                        }`}>{c.posicao}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground truncate">{c.nome}</div>
                          <div className="text-[10px] text-muted truncate">{c.rede}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-semibold text-foreground tabular-nums">{formatCompact(c.fat)}</div>
                          <div className="text-[10px] text-muted tabular-nums">{c.participacaoPct}%</div>
                        </div>
                        {/* Visual bar */}
                        <div className="w-16 h-1.5 bg-muted/10 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className="h-full bg-amber-500/60 rounded-full"
                            style={{ width: `${Math.min(c.participacaoPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}

          {/* ═══ AÇÕES SUGERIDAS (derived from status/metrics - presentation only) ═══ */}
          <section className="bg-muted/5 border border-border/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Ações Sugeridas</h3>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  const params = new URLSearchParams();
                  params.set("managerId", entry.managerId || entry.managerName);
                  params.set("origem", "RANKING_PERFORMANCE");
                  router.push(`/processo-comercial/follow-up?${params.toString()}`);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Gerar Follow-up
              </button>
            </div>

            <div className="space-y-2">
              {actionSuggestions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <div key={i} className="flex items-start gap-2 text-xs py-1.5">
                    <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                      action.priority === "Alta" ? "text-rose-400" :
                      action.priority === "Média" ? "text-amber-400" :
                      "text-emerald-400"
                    }`} />
                    <div className="flex-1">
                      <span className="text-foreground">{action.text}</span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                      action.priority === "Alta" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                      action.priority === "Média" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>{action.priority}</span>
                  </div>
                );
              })}
            </div>
          </section>


          {/* ═══ FOOTER ═══ */}
          <div className="text-center text-[10px] text-muted/50 py-2 border-t border-border/30">
            <ShieldCheck className="w-3 h-3 inline mr-1" />
            Dados oficiais — Analytics Engine V1
          </div>
        </div>
      </div>
    </>
  );
}
