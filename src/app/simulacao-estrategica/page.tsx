"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Sliders, Layers, BarChart3, Sparkles, AlertTriangle, ShieldCheck, TrendingUp } from "lucide-react";
import { CommercialScenarioData, ScenarioFilterOptions } from "@/lib/commercial-scenarios";

import { ScenarioFilterBar } from "./components/ScenarioFilterBar";
import { ScenarioKpis } from "./components/ScenarioKpis";
import { ScenarioBuilderPanel } from "./components/ScenarioBuilderPanel";
import { ScenarioComparisonPanel } from "./components/ScenarioComparisonPanel";
import { ImpactAnalysisPanel } from "./components/ImpactAnalysisPanel";
import { RecommendationValidationPanel } from "./components/RecommendationValidationPanel";
import { ScenarioAnalyticsPanel } from "./components/ScenarioAnalyticsPanel";

type ScenarioTab = "MODELAGEM" | "COMPARATIVO" | "IMPACTO" | "VALIDACAO" | "ANALYTICS";

export default function CommercialSimulationPage() {
  const [data, setData] = useState<CommercialScenarioData | null>(null);
  const [activeTab, setActiveTab] = useState<ScenarioTab>("MODELAGEM");
  const [filters, setFilters] = useState<ScenarioFilterOptions>({
    gerente: "TODOS",
    regional: "TODAS",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenarioData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (filters.gerente) query.append("gerente", filters.gerente);
      if (filters.regional) query.append("regional", filters.regional);

      const res = await fetch(`/api/commercial-scenarios?${query.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados de Simulação Estratégica.");

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Falha na resposta do servidor.");

      setData(json.data);
    } catch (err: any) {
      console.error("Erro na Simulação Estratégica:", err);
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchScenarioData();
  }, [fetchScenarioData]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-blue-500" />
            <Link href="/crm-enterprise" className="hover:text-foreground transition-colors">
              CRM Comercial Enterprise
            </Link>
            <ChevronRight className="w-3 h-3 text-blue-500" />
            <span className="text-foreground font-semibold">Simulação Estratégica (Sprint 3.4)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-sm">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Simulação Estratégica Comercial
              </h1>
              <p className="text-xs text-muted-foreground">
                Modelagem de premissas, comparação de cenários prospectivos e validador de hipóteses de vendas
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              COMMERCIAL_SIMULATION = ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Mensagem de Erro se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchScenarioData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <ScenarioFilterBar
        filters={filters}
        onFilterChange={setFilters}
        loading={loading}
        onRefresh={fetchScenarioData}
      />

      {/* Cards de KPIs Prospectivos */}
      {data?.kpis && <ScenarioKpis kpis={data.kpis} />}

      {/* Seletor de Abas */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("MODELAGEM")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "MODELAGEM"
              ? "bg-blue-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Modelagem de Cenários
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COMPARATIVO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "COMPARATIVO"
              ? "bg-blue-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Matriz Comparativa
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("IMPACTO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "IMPACTO"
              ? "bg-blue-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Análise de Impacto
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("VALIDACAO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "VALIDACAO"
              ? "bg-blue-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Validador de Hipóteses
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ANALYTICS"
              ? "bg-blue-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Analytics Prospectivo
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {data && activeTab === "MODELAGEM" && <ScenarioBuilderPanel scenarios={data.scenarios} />}

      {data && activeTab === "COMPARATIVO" && <ScenarioComparisonPanel comparisonTable={data.comparisonTable} />}

      {data && activeTab === "IMPACTO" && <ImpactAnalysisPanel />}

      {data && activeTab === "VALIDACAO" && <RecommendationValidationPanel validations={data.validations} />}

      {data && activeTab === "ANALYTICS" && <ScenarioAnalyticsPanel data={data} />}
    </div>
  );
}
