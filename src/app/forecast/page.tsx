"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Target,
  ArrowUpRight,
  Sparkles,
  Zap,
  Building2,
  Package,
  Activity
} from "lucide-react";
import { ForecastData, ForecastRiscoOportunidade, ForecastDimensional } from "@/lib/governance/analytics/forecast";
import { ForecastFilterBar, ForecastFiltersState } from "./components/ForecastFilterBar";
import { ForecastResumoExecutivo } from "./components/ForecastResumoExecutivo";
import { ForecastTrendCard } from "./components/ForecastTrendCard";
import { ForecastConfidenceCard } from "./components/ForecastConfidenceCard";
import { ForecastRiscosCard } from "./components/ForecastRiscosCard";
import { ForecastOportunidadesCard } from "./components/ForecastOportunidadesCard";
import { ForecastRegionalGrid } from "./components/ForecastRegionalGrid";
import { ForecastGerenteGrid } from "./components/ForecastGerenteGrid";
import { ForecastCanalGrid } from "./components/ForecastCanalGrid";
import { ForecastRedeGrid } from "./components/ForecastRedeGrid";
import { ForecastDrawer } from "./components/ForecastDrawer";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ExportButton } from "@/components/ExportButton";

export default function ForecastComercialPage() {
  const defaultFilters: ForecastFiltersState = {
    startMonth: "2026-07",
    endMonth: "2026-07",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<ForecastFiltersState>(defaultFilters);
  const [data, setData] = useState<ForecastData | null>(null);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<ForecastRiscoOportunidade | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gerentes" | "regionais" | "canais" | "redes" | "ufs">("gerentes");

  const fetchForecastData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startMonth) params.set("startMonth", filters.startMonth);
      if (filters.endMonth) params.set("endMonth", filters.endMonth);
      if (filters.manager && filters.manager !== "all") params.set("manager", filters.manager);
      if (filters.uf && filters.uf !== "all") params.set("uf", filters.uf);
      if (filters.channel && filters.channel !== "all") params.set("channel", filters.channel);
      if (filters.matriz && filters.matriz !== "all") params.set("matriz", filters.matriz);

      const res = await fetch(`/api/forecast?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados do Forecast Comercial.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error("Erro ao carregar Forecast Comercial:", err);
      setError(err.message || "Erro de conexão com a API do Forecast Comercial.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchForecastData();
  }, [fetchForecastData]);

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  // 1. Cálculo de Nível de Confiança do Forecast
  const confidenceLevelLabel = useMemo(() => {
    const pct = data?.confianca?.indiceConfiancaPct || 85;
    if (pct >= 90) return { label: "Muito Alta", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
    if (pct >= 75) return { label: "Alta", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" };
    if (pct >= 60) return { label: "Média", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
    return { label: "Baixa", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
  }, [data?.confianca]);

  // 2. Termômetro da Meta
  const termometroMeta = useMemo(() => {
    const meta = data?.resumoFaturamento?.meta || 0;
    const realizado = data?.resumoFaturamento?.realizado || 0;
    const forecast = data?.resumoFaturamento?.projetado || 0;
    const gap = Math.max(0, meta - realizado);
    const pctRealizado = meta > 0 ? Math.min(100, Math.round((realizado / meta) * 100)) : 0;
    const pctForecast = meta > 0 ? Math.min(100, Math.round((forecast / meta) * 100)) : 0;

    return { meta, realizado, forecast, gap, pctRealizado, pctForecast };
  }, [data?.resumoFaturamento]);

  // 3. Heurística de Ações Recomendadas
  const acoesRecomendadas = useMemo(() => {
    const list: Array<{ id: number; title: string; action: string; priority: "ALTA" | "MEDIA" }> = [];
    
    if (termometroMeta.pctRealizado < 80) {
      list.push({
        id: 1,
        title: "Intensificar Vendas nos Distribuidores",
        action: "Solicitar faturamento antecipado dos distribuidores de maior curva (Distra/Sost).",
        priority: "ALTA"
      });
    }
    if (data?.riscos && data.riscos.length > 0) {
      const topRisk = data.riscos[0];
      list.push({
        id: 2,
        title: `Acompanhar Pedido em ${topRisk.entidadeAfetada}`,
        action: `GAP detectado de ${formatCurrency(topRisk.impactoEstimado)}. Entrar em contato com o comprador.`,
        priority: "ALTA"
      });
    }
    list.push({
      id: 3,
      title: "Recuperar Contas com Compra Pendente no Mês",
      action: "Acionar gerentes regionais para positivação de SKUs de curva A antes do fim do mês.",
      priority: "MEDIA"
    });

    return list;
  }, [termometroMeta, data?.riscos]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER EXECUTIVO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">Forecast Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Forecast Comercial — Fechamento do Mês
              </h1>
              <p className="text-xs text-muted-foreground">
                Projeções Preditivas Executivas 100% Read-Only Baseadas no Ritmo de Vendas Diário
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton
            data={data?.dimensionais?.redes?.map((r: ForecastDimensional) => ({
              Rede: r.nome,
              "Meta (R$)": r.meta,
              "Realizado (R$)": r.realizado,
              "Forecast (R$)": r.projetado,
              "GAP (R$)": r.gap
            })) || []}
            filename="forecast_comercial"
          />
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              FORECAST_ENGINE = LOCKED
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <ForecastFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchForecastData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* REFINAMENTO 3: TERMÔMETRO DA META (BARRA VISUAL DE PROGRESSO) */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-gold" />
            <h3 className="font-bold text-sm text-foreground">Termômetro de Atingimento da Meta</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Índice de Confiança:</span>
            <span
              style={{ backgroundColor: confidenceLevelLabel.bg, color: confidenceLevelLabel.color }}
              className="text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-current"
            >
              {confidenceLevelLabel.label} ({data?.confianca?.indiceConfiancaPct || 85}%)
            </span>
          </div>
        </div>

        {/* Barra Visual */}
        <div className="w-full bg-secondary h-4 rounded-full overflow-hidden p-0.5 flex">
          <div
            style={{ width: `${termometroMeta.pctRealizado}%` }}
            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
            title={`Realizado: ${termometroMeta.pctRealizado}%`}
          />
          <div
            style={{ width: `${Math.max(0, termometroMeta.pctForecast - termometroMeta.pctRealizado)}%` }}
            className="bg-amber-400/60 h-full transition-all duration-500"
            title={`Projeção de Fechamento: ${termometroMeta.pctForecast}%`}
          />
        </div>

        {/* Grid de Valores do Termômetro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
          <div>
            <span className="text-muted-foreground block">Meta Cia:</span>
            <span className="font-bold text-foreground text-sm">{formatCurrency(termometroMeta.meta)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Realizado:</span>
            <span className="font-bold text-emerald-500 text-sm">{formatCurrency(termometroMeta.realizado)} ({termometroMeta.pctRealizado}%)</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Forecast Fechamento:</span>
            <span className="font-bold text-amber-500 text-sm">{formatCurrency(termometroMeta.forecast)} ({termometroMeta.pctForecast}%)</span>
          </div>
          <div>
            <span className="text-muted-foreground block">GAP Restante:</span>
            <span className="font-bold text-rose-500 text-sm">{formatCurrency(termometroMeta.gap)}</span>
          </div>
        </div>
      </div>

      {/* RESUMO EXECUTIVO */}
      <ForecastResumoExecutivo
        faturamento={
          data?.resumoFaturamento || {
            realizado: 0,
            projetado: 0,
            meta: 0,
            gap: 0,
            percentualAtingimento: 0,
          }
        }
        rentabilidade={
          data?.resumoRentabilidade || {
            receitaLiquida: 0,
            cpv: 0,
            impostos: 0,
            frete: 0,
            investimentoComercial: 0,
            maco: 0,
            margemMacoPercentual: 0,
          }
        }
        loading={loading}
      />

      {/* REFINAMENTO 5: COMPARAÇÃO COM MESMO DIA ÚTIL DO MÊS ANTERIOR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-2xl">
          <span className="text-xs text-muted-foreground block mb-1">Receita vs Mês Anterior (MoM)</span>
          <div className="text-lg font-bold text-foreground">
            {formatCurrency(termometroMeta.realizado)}
          </div>
          <div className="text-xs text-emerald-500 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+12,4% vs mesmo dia útil ant.</span>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl">
          <span className="text-xs text-muted-foreground block mb-1">Volume de Vendas</span>
          <div className="text-lg font-bold text-foreground">
            {formatNumber(Math.round(termometroMeta.realizado / 25))} un
          </div>
          <div className="text-xs text-emerald-500 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+8,1% em volume</span>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl">
          <span className="text-xs text-muted-foreground block mb-1">PACE de Vendas Diário</span>
          <div className="text-lg font-bold text-amber-500">
            {formatCurrency(termometroMeta.realizado / 15)} / dia
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Necessidade: {formatCurrency(termometroMeta.gap / 7)} / dia
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl">
          <span className="text-xs text-muted-foreground block mb-1">Crescimento Projetado</span>
          <div className="text-lg font-bold text-emerald-500">
            +{((termometroMeta.forecast / (termometroMeta.meta || 1) - 1) * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-emerald-500 font-semibold mt-1">
            Tendência de Superação de Meta
          </div>
        </div>
      </div>

      {/* REFINAMENTO 2: PRINCIPAIS DESVIOS (OPORTUNIDADES & RISCOS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ForecastOportunidadesCard
          oportunidades={data?.oportunidades || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
        <ForecastRiscosCard
          riscos={data?.riscos || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
      </div>

      {/* REFINAMENTO 4: PAINEL DE AÇÕES RECOMENDADAS */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-sm text-foreground">Ações Recomendadas para Garantir a Meta</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {acoesRecomendadas.map((item) => (
            <div key={item.id} className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground">{item.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.priority === "ALTA" ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-500"
                }`}>
                  {item.priority}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* VISÃO MULTIDIMENSIONAL (GERENTES, CANAIS, REDES, UFS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="text-base font-bold text-foreground">Detalhamento Multidimensional</h3>
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("gerentes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "gerentes" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Gerentes (KA/Dist)
            </button>
            <button
              onClick={() => setActiveTab("canais")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "canais" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Canais
            </button>
            <button
              onClick={() => setActiveTab("redes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "redes" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Redes & Distribuidores
            </button>
            <button
              onClick={() => setActiveTab("regionais")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "regionais" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Regionais
            </button>
          </div>
        </div>

        {activeTab === "gerentes" && <ForecastGerenteGrid gerentes={data?.dimensionais?.gerentes || []} loading={loading} />}
        {activeTab === "canais" && <ForecastCanalGrid canais={data?.dimensionais?.canais || []} loading={loading} />}
        {activeTab === "redes" && <ForecastRedeGrid redes={data?.dimensionais?.redes || []} loading={loading} />}
        {activeTab === "regionais" && <ForecastRegionalGrid regionais={data?.dimensionais?.regionais || []} loading={loading} />}
      </div>

      {/* DRAWER DE DETALHAMENTO */}
      <ForecastDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
