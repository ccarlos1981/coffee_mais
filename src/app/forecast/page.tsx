"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { ForecastData, ForecastRiscoOportunidade } from "@/lib/governance/analytics/forecast";
import { ForecastFilterBar, ForecastFiltersState } from "./components/ForecastFilterBar";
import { ForecastResumoExecutivo } from "./components/ForecastResumoExecutivo";
import { ForecastFaturamentoCard } from "./components/ForecastFaturamentoCard";
import { ForecastRentabilidadeCard } from "./components/ForecastRentabilidadeCard";
import { ForecastTrendCard } from "./components/ForecastTrendCard";
import { ForecastConfidenceCard } from "./components/ForecastConfidenceCard";
import { ForecastExplanationCard } from "./components/ForecastExplanationCard";
import { ForecastScenarioCard } from "./components/ForecastScenarioCard";
import { ForecastRecommendationCard } from "./components/ForecastRecommendationCard";
import { ForecastModelQualityCard } from "./components/ForecastModelQualityCard";
import { ForecastRiscosCard } from "./components/ForecastRiscosCard";
import { ForecastOportunidadesCard } from "./components/ForecastOportunidadesCard";
import { ForecastRegionalGrid } from "./components/ForecastRegionalGrid";
import { ForecastGerenteGrid } from "./components/ForecastGerenteGrid";
import { ForecastCanalGrid } from "./components/ForecastCanalGrid";
import { ForecastRedeGrid } from "./components/ForecastRedeGrid";
import { ForecastUfGrid } from "./components/ForecastUfGrid";
import { ForecastDrawer } from "./components/ForecastDrawer";

export default function ForecastComercialPage() {
  const defaultFilters: ForecastFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
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

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Cabeçalho Executivo & Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          {/* Breadcrumbs */}
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

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            FORECAST_ENGINE = ISOLATED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <ForecastFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Mensagem de Erro se houver */}
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

      {/* 3. Resumo Executivo */}
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

      {/* 4. Tendência & Grau de Confiança */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ForecastTrendCard tendencia={data?.tendenciaGlobal || "ESTABILIDADE"} loading={loading} />
        <div className="md:col-span-2">
          <ForecastConfidenceCard
            confianca={
              data?.confianca || {
                indiceConfiancaPct: 0,
                nivel: "BAIXO",
                fatoresPositivos: [],
                fatoresNegativos: [],
              }
            }
            loading={loading}
          />
        </div>
      </div>

      {/* 5. Forecast de Faturamento & Rentabilidade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ForecastFaturamentoCard
          faturamento={
            data?.resumoFaturamento || {
              realizado: 0,
              projetado: 0,
              meta: 0,
              gap: 0,
              percentualAtingimento: 0,
            }
          }
          loading={loading}
        />
        <ForecastRentabilidadeCard
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
      </div>

      {/* 6. Explicação Executiva & Cenários em Memória */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ForecastExplanationCard
          explicacao={
            data?.explicacao || {
              resumoExecutivo: "",
              driversPrincipais: [],
              alertasPontuais: [],
            }
          }
          loading={loading}
        />
        <ForecastScenarioCard
          cenarios={
            data?.cenarios || {
              cenarioBase: 0,
              cenarioConservador: 0,
              cenarioOtimista: 0,
              cenarioPessimista: 0,
            }
          }
          loading={loading}
        />
      </div>

      {/* 7. Recomendações Executivas & Qualidade do Modelo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <ForecastRecommendationCard recomendacoes={data?.recomendacoes || []} loading={loading} />
        </div>
        <ForecastModelQualityCard
          qualidadeModelo={
            data?.qualidadeModelo || {
              precisaoHistoricaPct: 0,
              erroMedioPct: 0,
              maiorErroHistoricoPct: 0,
              confiabilidadeModeloPct: 0,
            }
          }
          loading={loading}
        />
      </div>

      {/* 8. Riscos & Oportunidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ForecastRiscosCard
          riscos={data?.riscos || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
        <ForecastOportunidadesCard
          oportunidades={data?.oportunidades || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
      </div>

      {/* 9. Grids Dimensionais em Abas */}
      <div className="space-y-3">
        <div className="flex border-b border-border text-xs gap-2">
          <button
            onClick={() => setActiveTab("gerentes")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "gerentes"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Gerentes Comerciais
          </button>
          <button
            onClick={() => setActiveTab("regionais")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "regionais"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Regionais
          </button>
          <button
            onClick={() => setActiveTab("canais")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "canais"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Canais
          </button>
          <button
            onClick={() => setActiveTab("redes")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "redes"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Redes / Matrizes
          </button>
          <button
            onClick={() => setActiveTab("ufs")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "ufs"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            UFs (Estados)
          </button>
        </div>

        {activeTab === "gerentes" && (
          <ForecastGerenteGrid gerentes={data?.dimensionais.gerentes || []} loading={loading} />
        )}
        {activeTab === "regionais" && (
          <ForecastRegionalGrid regionais={data?.dimensionais.regionais || []} loading={loading} />
        )}
        {activeTab === "canais" && (
          <ForecastCanalGrid canais={data?.dimensionais.canais || []} loading={loading} />
        )}
        {activeTab === "redes" && (
          <ForecastRedeGrid redes={data?.dimensionais.redes || []} loading={loading} />
        )}
        {activeTab === "ufs" && (
          <ForecastUfGrid ufs={data?.dimensionais.ufs || []} loading={loading} />
        )}
      </div>

      {/* 10. Drawer Lateral Read-Only */}
      <ForecastDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
