"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Sliders, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { SimulationData, SimulationParams, SimulationRiscoOportunidade } from "@/lib/governance/analytics/simulation";
import { SimulationFilterBar, SimulationFiltersState } from "./components/SimulationFilterBar";
import { ScenarioEditor } from "./components/ScenarioEditor";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { SimulationForecastCard } from "./components/SimulationForecastCard";
import { SimulationImpactCard } from "./components/SimulationImpactCard";
import { SimulationROI } from "./components/SimulationROI";
import { SimulationPayback } from "./components/SimulationPayback";
import { SimulationRecommendationCard } from "./components/SimulationRecommendationCard";
import { SimulationRiskCard } from "./components/SimulationRiskCard";
import { SimulationOpportunityCard } from "./components/SimulationOpportunityCard";
import { SimulationRegionalGrid } from "./components/SimulationRegionalGrid";
import { SimulationGerenteGrid } from "./components/SimulationGerenteGrid";
import { SimulationCanalGrid } from "./components/SimulationCanalGrid";
import { SimulationRedeGrid } from "./components/SimulationRedeGrid";
import { SimulationUfGrid } from "./components/SimulationUfGrid";
import { SimulationSkuGrid } from "./components/SimulationSkuGrid";
import { SimulationTimeline } from "./components/SimulationTimeline";
import { SimulationDrawer } from "./components/SimulationDrawer";

export default function SimuladorComercialPage() {
  const defaultFilters: SimulationFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const defaultParams: SimulationParams = {
    nomeCenario: "Simulação de Expansão Comercial",
    tipoAcao: "RECUPERAR_REDE",
    variacaoFaturamentoPct: 8.5,
    variacaoMacoPct: 1.2,
    investimentoAdicionalR$: 150000,
    targetRedeOuCliente: "Redes Globais",
  };

  const [filters, setFilters] = useState<SimulationFiltersState>(defaultFilters);
  const [scenarioParams, setScenarioParams] = useState<SimulationParams>(defaultParams);
  const [data, setData] = useState<SimulationData | null>(null);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<SimulationRiscoOportunidade | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gerentes" | "regionais" | "canais" | "redes" | "ufs" | "skus">("gerentes");

  const runSimulation = useCallback(async () => {
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

      if (scenarioParams.nomeCenario) params.set("nomeCenario", scenarioParams.nomeCenario);
      if (scenarioParams.tipoAcao) params.set("tipoAcao", scenarioParams.tipoAcao);
      params.set("variacaoFaturamentoPct", String(scenarioParams.variacaoFaturamentoPct));
      params.set("variacaoMacoPct", String(scenarioParams.variacaoMacoPct));
      params.set("investimentoAdicionalR$", String(scenarioParams.investimentoAdicionalR$));

      const res = await fetch(`/api/simulador?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao executar simulação comercial.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error("Erro ao executar Simulador Comercial:", err);
      setError(err.message || "Erro de conexão com a API do Simulador Comercial.");
    } finally {
      setLoading(false);
    }
  }, [filters, scenarioParams]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

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
            <span className="text-foreground font-semibold">Simulador Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Simulador Comercial — Decisões Estratégicas
              </h1>
              <p className="text-xs text-muted-foreground">
                Simulação de Cenários Comerciais 100% em Memória com Recalculação em Tempo Real
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            SIMULATION_ENGINE = MEMORY_ONLY
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <SimulationFilterBar
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
            onClick={runSimulation}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3. Editor do Cenário da Simulação */}
      <ScenarioEditor
        params={scenarioParams}
        onChange={setScenarioParams}
        onSimulate={runSimulation}
        loading={loading}
      />

      {/* 4. Impactos Globais (Faturamento & MACO) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SimulationForecastCard
          impacto={
            data?.impactoGlobal || {
              faturamentoOriginal: 0,
              faturamentoSimulado: 0,
              diferencaFaturamento: 0,
              variacaoFaturamentoPct: 0,
              macoOriginal: 0,
              macoSimulado: 0,
              diferencaMaco: 0,
              roiSimuladoPct: 0,
              paybackMeses: 0,
            }
          }
          loading={loading}
        />
        <SimulationImpactCard
          impacto={
            data?.impactoGlobal || {
              faturamentoOriginal: 0,
              faturamentoSimulado: 0,
              diferencaFaturamento: 0,
              variacaoFaturamentoPct: 0,
              macoOriginal: 0,
              macoSimulado: 0,
              diferencaMaco: 0,
              roiSimuladoPct: 0,
              paybackMeses: 0,
            }
          }
          loading={loading}
        />
      </div>

      {/* 5. ROI & Payback */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SimulationROI
          impacto={
            data?.impactoGlobal || {
              faturamentoOriginal: 0,
              faturamentoSimulado: 0,
              diferencaFaturamento: 0,
              variacaoFaturamentoPct: 0,
              macoOriginal: 0,
              macoSimulado: 0,
              diferencaMaco: 0,
              roiSimuladoPct: 0,
              paybackMeses: 0,
            }
          }
          loading={loading}
        />
        <SimulationPayback
          impacto={
            data?.impactoGlobal || {
              faturamentoOriginal: 0,
              faturamentoSimulado: 0,
              diferencaFaturamento: 0,
              variacaoFaturamentoPct: 0,
              macoOriginal: 0,
              macoSimulado: 0,
              diferencaMaco: 0,
              roiSimuladoPct: 0,
              paybackMeses: 0,
            }
          }
          loading={loading}
        />
      </div>

      {/* 6. Matriz de Cenários Comparativos */}
      <ScenarioComparison cenarios={data?.cenariosComparativos || []} loading={loading} />

      {/* 7. Recomendações Automáticas da Simulação */}
      <SimulationRecommendationCard recomendacoes={data?.recomendacoes || []} loading={loading} />

      {/* 8. Riscos & Oportunidades da Simulação */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SimulationRiskCard
          riscos={data?.riscos || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
        <SimulationOpportunityCard
          oportunidades={data?.oportunidades || []}
          onSelect={setSelectedDrawerItem}
          loading={loading}
        />
      </div>

      {/* 9. Timeline de Evolução */}
      <SimulationTimeline timeline={data?.timeline || []} loading={loading} />

      {/* 10. Grids Dimensionais em Abas */}
      <div className="space-y-3">
        <div className="flex border-b border-border text-xs gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("gerentes")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "gerentes"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Gerentes
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
            Redes
          </button>
          <button
            onClick={() => setActiveTab("ufs")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "ufs"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            UFs
          </button>
          <button
            onClick={() => setActiveTab("skus")}
            className={`py-2 px-4 font-bold border-b-2 transition-all ${
              activeTab === "skus"
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            SKUs
          </button>
        </div>

        {activeTab === "gerentes" && (
          <SimulationGerenteGrid gerentes={data?.dimensionais.gerentes || []} loading={loading} />
        )}
        {activeTab === "regionais" && (
          <SimulationRegionalGrid regionais={data?.dimensionais.regionais || []} loading={loading} />
        )}
        {activeTab === "canais" && (
          <SimulationCanalGrid canais={data?.dimensionais.canais || []} loading={loading} />
        )}
        {activeTab === "redes" && (
          <SimulationRedeGrid redes={data?.dimensionais.redes || []} loading={loading} />
        )}
        {activeTab === "ufs" && (
          <SimulationUfGrid ufs={data?.dimensionais.ufs || []} loading={loading} />
        )}
        {activeTab === "skus" && (
          <SimulationSkuGrid skus={data?.dimensionais.skus || []} loading={loading} />
        )}
      </div>

      {/* 11. Drawer Lateral Read-Only */}
      <SimulationDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
