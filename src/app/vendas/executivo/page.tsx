"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  Target,
  DollarSign,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Award,
  Layers,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ExecutiveCommercialData } from "@/lib/governance/executive/executiveCommercialService";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const YEARS = [2024, 2025, 2026];

export default function DashboardExecutivoPage() {
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveCommercialData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        year: filterYear.toString(),
        month: filterMonth.toString(),
      });

      const res = await fetch(`/api/vendas/executivo?${params}`, { cache: "no-store" });
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Erro ao carregar dados executivos.");
      }
    } catch (err: any) {
      console.error("Erro no Dashboard Executivo:", err);
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const r = data?.resumoExecutivo;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar Executiva */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/vendas"
              className="p-2 rounded-lg bg-muted/20 hover:bg-muted/30 text-muted transition-colors"
              title="Voltar ao Vendas Operacional"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground uppercase tracking-wide">
                  Dashboard Executivo Comercial
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck className="w-3 h-3" /> C-Level / Head
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Visão consolidada gerencial — {MONTHS[filterMonth - 1]} {filterYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Controles de Ano e Mês */}
            <div className="flex items-center gap-2">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-amber-500"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={fetchData}
                disabled={loading}
                className="p-1.5 rounded-lg bg-muted/20 hover:bg-muted/30 text-muted transition-colors"
                title="Atualizar Dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {data?.periodo && (
              <div className="text-right text-xs text-muted border-l border-border pl-3 hidden md:block">
                <span className="font-semibold text-foreground">{data.periodo.elapsedDays}/{data.periodo.totalDays}</span> dias úteis
              </div>
            )}

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="glass-card flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-muted text-xs font-bold uppercase tracking-widest animate-pulse">
              Carregando Inteligência Executiva...
            </p>
          </div>
        ) : error ? (
          <div className="glass-card p-8 text-center text-rose-400 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* ═══ 1. CARDS RESUMO EXECUTIVO ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Faturamento Real x Meta */}
              <div className="glass-card p-4 space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Faturamento Real</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency((r?.realFat || 0) / 1000, 0)} <span className="text-xs text-muted font-normal">/1k</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted">Meta: {formatCurrency((r?.metaFat || 0) / 1000, 0)}</span>
                  <span className={`font-semibold ${r && r.variacaoMom >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {r && r.variacaoMom >= 0 ? "+" : ""}{r?.variacaoMom.toFixed(1)}% MoM
                  </span>
                </div>
              </div>

              {/* Tendência de Fechamento (Tend %) */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Tendência (Tend %)</span>
                  <Target className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {r?.tendPct.toFixed(1)}%
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted">Pace: {formatCurrency((r?.paceFat || 0) / 1000, 0)}</span>
                  <span className="text-muted">Venda Fut.: {formatCurrency((r?.vendaFutura || 0) / 1000, 0)}</span>
                </div>
              </div>

              {/* Margem MaCo Executiva */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">MaCo Real / Margem %</span>
                  <Award className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency((r?.realMaco || 0) / 1000, 0)} <span className="text-xs text-blue-400 font-normal">({r?.margemMacoPct.toFixed(1)}%)</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted">Meta MaCo: {formatCurrency((r?.metaMaco || 0) / 1000, 0)}</span>
                  <span className="text-emerald-400 font-semibold">Saudável</span>
                </div>
              </div>

              {/* Crescimento YoY */}
              <div className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">Crescimento YoY</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                  {r && r.variacaoYoy >= 0 ? "+" : ""}{r?.variacaoYoy.toFixed(1)}%
                </div>
                <div className="text-xs text-muted pt-1 border-t border-border/50">
                  Comparativo vs mesmo período ano anterior
                </div>
              </div>
            </div>

            {/* ═══ 2. RANKINGS E ALERTAS ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Ranking de Gerentes */}
              <div className="glass-card p-5 space-y-4 lg:col-span-1">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Desempenho por Gerente
                  </h3>
                  <Users className="w-4 h-4 text-muted" />
                </div>
                <div className="space-y-3">
                  {(data?.rankingGerentes || []).map((g, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/10 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground">{g.gerente}</span>
                        <span className={`font-bold ${g.tendPct >= 100 ? "text-emerald-400" : g.tendPct >= 80 ? "text-amber-400" : "text-rose-400"}`}>
                          {g.tendPct}% Tend.
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>Real: {formatCurrency(g.real / 1000)}</span>
                        <span>Meta: {formatCurrency(g.meta / 1000)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ranking de Redes (Rolling FAT 3M) */}
              <div className="glass-card p-5 space-y-4 lg:col-span-1">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Top Redes (Rolling FAT 3M)
                  </h3>
                  <Layers className="w-4 h-4 text-muted" />
                </div>
                <div className="space-y-3">
                  {(data?.rankingRedes || []).map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-muted/10 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-foreground truncate max-w-[160px]">{r.rede}</span>
                        <span className="text-amber-400 font-bold">{formatCurrency(r.real3M / 1000)} /3M</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>Gerente: {r.gerente}</span>
                        <span>Mês: {formatCurrency(r.realMes / 1000)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas Executivos & Oportunidades */}
              <div className="glass-card p-5 space-y-4 lg:col-span-1">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Alertas & Ações Prioritárias
                  </h3>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <div className="space-y-3">
                  {(data?.alertasExecutivos || []).map((alt) => (
                    <div
                      key={alt.id}
                      className={`p-3 rounded-lg border ${
                        alt.nivel === "CRITICO"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : alt.nivel === "ALERTA"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                      }`}
                    >
                      <h4 className="text-xs font-bold mb-1">{alt.titulo}</h4>
                      <p className="text-[11px] opacity-90">{alt.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ 3. TOP ACELERAÇÕES & QUEDAS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Top Clientes em Aceleração (+15%)
                </h3>
                <div className="space-y-2">
                  {(data?.movimentacaoCarteira.topAceleracoes || []).map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-emerald-500/5 border border-emerald-500/10 text-xs">
                      <span className="font-semibold text-foreground">{c.cliente}</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">+{c.variacaoPct}%</span>
                        <div className="text-[10px] text-muted">{formatCurrency(c.valor / 1000)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase text-rose-400 tracking-wider flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Clientes em Desaceleração (-15%)
                </h3>
                <div className="space-y-2">
                  {(data?.movimentacaoCarteira.topQuedas || []).map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded bg-rose-500/5 border border-rose-500/10 text-xs">
                      <span className="font-semibold text-foreground">{c.cliente}</span>
                      <div className="text-right">
                        <span className="font-bold text-rose-400">{c.variacaoPct}%</span>
                        <div className="text-[10px] text-muted">{formatCurrency(c.valor / 1000)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
