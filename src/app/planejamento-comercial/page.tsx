"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Calendar, Building2, Target, CheckSquare, BarChart3, AlertTriangle, ShieldCheck } from "lucide-react";
import { CommercialPlanningData, PlanningFilterOptions } from "@/lib/commercial-planning";

import { PlanningFilterBar } from "./components/PlanningFilterBar";
import { PlanningKpis } from "./components/PlanningKpis";
import { PlanningCyclePanel } from "./components/PlanningCyclePanel";
import { CommercialPlanPanel } from "./components/CommercialPlanPanel";
import { GoalDistributionPanel } from "./components/GoalDistributionPanel";
import { ActionPlanOrchestratorPanel } from "./components/ActionPlanOrchestratorPanel";
import { PlanningAnalyticsPanel } from "./components/PlanningAnalyticsPanel";

type PlanningTab = "CICLOS" | "PLANO" | "METAS" | "ACOES" | "ANALYTICS";

export default function CommercialPlanningPage() {
  const [data, setData] = useState<CommercialPlanningData | null>(null);
  const [activeTab, setActiveTab] = useState<PlanningTab>("CICLOS");
  const [filters, setFilters] = useState<PlanningFilterOptions>({
    gerente: "TODOS",
    regional: "TODAS",
    cicloId: "cyc-q3-2026",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanningData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (filters.gerente) query.append("gerente", filters.gerente);
      if (filters.regional) query.append("regional", filters.regional);

      const res = await fetch(`/api/commercial-planning?${query.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados de Planejamento Comercial.");

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Falha na resposta do servidor.");

      setData(json.data);
    } catch (err: any) {
      console.error("Erro no Planejamento Comercial:", err);
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPlanningData();
  }, [fetchPlanningData]);

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
            <ChevronRight className="w-3 h-3 text-indigo-500" />
            <Link href="/crm-enterprise" className="hover:text-foreground transition-colors">
              CRM Comercial Enterprise
            </Link>
            <ChevronRight className="w-3 h-3 text-indigo-500" />
            <span className="text-foreground font-semibold">Planejamento Comercial Integrado (Sprint 3.5)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shadow-sm">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Planejamento Comercial Integrado (S&OP)
              </h1>
              <p className="text-xs text-muted-foreground">
                Orquestração corporativa dos ciclos S&OP, plano comercial oficial, desdobramento de metas e governança
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              COMMERCIAL_PLANNING = ACTIVE
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
            onClick={fetchPlanningData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <PlanningFilterBar
        filters={filters}
        onFilterChange={setFilters}
        loading={loading}
        onRefresh={fetchPlanningData}
      />

      {/* Cards de KPIs */}
      {data?.kpis && <PlanningKpis kpis={data.kpis} />}

      {/* Seletor de Abas */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("CICLOS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "CICLOS"
              ? "bg-indigo-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Ciclos S&OP
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PLANO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "PLANO"
              ? "bg-indigo-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Plano Comercial Oficial
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("METAS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "METAS"
              ? "bg-indigo-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Target className="w-4 h-4" />
          Desdobramento de Metas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ACOES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ACOES"
              ? "bg-indigo-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Planos Estratégicos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ANALYTICS"
              ? "bg-indigo-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics S&OP
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {data && activeTab === "CICLOS" && (
        <PlanningCyclePanel cycles={data.cycles} workflowHistory={data.workflowHistory} />
      )}

      {data && activeTab === "PLANO" && <CommercialPlanPanel plans={data.plans} />}

      {data && activeTab === "METAS" && <GoalDistributionPanel goalDistributions={data.goalDistributions} />}

      {data && activeTab === "ACOES" && (
        <ActionPlanOrchestratorPanel strategicActions={data.strategicActions} />
      )}

      {data && activeTab === "ANALYTICS" && <PlanningAnalyticsPanel data={data} />}
    </div>
  );
}
