"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Calendar, Navigation, Clock, CheckSquare, BarChart3, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { CommercialExecutionData, ExecutionFilterOptions } from "@/lib/commercial-execution";

import { ExecutionFilterBar } from "./components/ExecutionFilterBar";
import { ExecutionKpis } from "./components/ExecutionKpis";
import { DailyAgendaPanel } from "./components/DailyAgendaPanel";
import { VisitPlanningPanel } from "./components/VisitPlanningPanel";
import { FollowUpPanel } from "./components/FollowUpPanel";
import { TaskManagementPanel } from "./components/TaskManagementPanel";
import { ExecutionAnalyticsPanel } from "./components/ExecutionAnalyticsPanel";

type ExecutionTab = "AGENDA" | "PLANEJAMENTO" | "FOLLOWUPS" | "TAREFAS" | "ANALYTICS";

export default function CommercialExecutionPage() {
  const [data, setData] = useState<CommercialExecutionData | null>(null);
  const [activeTab, setActiveTab] = useState<ExecutionTab>("AGENDA");
  const [filters, setFilters] = useState<ExecutionFilterOptions>({
    gerente: "TODOS",
    regional: "TODAS",
    data: "2026-07-28",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (filters.gerente) query.append("gerente", filters.gerente);
      if (filters.regional) query.append("regional", filters.regional);
      if (filters.data) query.append("data", filters.data);

      const res = await fetch(`/api/commercial-execution?${query.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados de Execução Comercial.");

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Falha na resposta do servidor.");

      setData(json.data);
    } catch (err: any) {
      console.error("Erro na Execução Comercial:", err);
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExecutionData();
  }, [fetchExecutionData]);

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
            <ChevronRight className="w-3 h-3 text-emerald-500" />
            <Link href="/crm-enterprise" className="hover:text-foreground transition-colors">
              CRM Comercial Enterprise
            </Link>
            <ChevronRight className="w-3 h-3 text-emerald-500" />
            <span className="text-foreground font-semibold">Execução Comercial & Agenda (Sprint 3.2)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Execução Comercial & Agenda Inteligente
              </h1>
              <p className="text-xs text-muted-foreground">
                Planejamento e execução operacional da rotina comercial, roteirização de visitas, follow-ups e tarefas
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              COMMERCIAL_EXECUTION = ACTIVE
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
            onClick={fetchExecutionData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros Operacionais */}
      <ExecutionFilterBar
        filters={filters}
        onFilterChange={setFilters}
        loading={loading}
        onRefresh={fetchExecutionData}
      />

      {/* Cards de KPIs */}
      {data?.kpis && <ExecutionKpis kpis={data.kpis} />}

      {/* Seletor de Abas */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("AGENDA")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "AGENDA"
              ? "bg-emerald-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Agenda Comercial Diária
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PLANEJAMENTO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "PLANEJAMENTO"
              ? "bg-emerald-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Navigation className="w-4 h-4" />
          Planejamento de Visitas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FOLLOWUPS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${

            activeTab === "FOLLOWUPS"
              ? "bg-emerald-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Gestão de Follow-ups
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TAREFAS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "TAREFAS"
              ? "bg-emerald-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Tarefas Comerciais
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ANALYTICS"
              ? "bg-emerald-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics de Execução
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {data && activeTab === "AGENDA" && <DailyAgendaPanel agenda={data.agenda} />}

      {data && activeTab === "PLANEJAMENTO" && <VisitPlanningPanel visitPlans={data.visitPlans} />}

      {data && activeTab === "FOLLOWUPS" && <FollowUpPanel followUps={data.followUps} />}

      {data && activeTab === "TAREFAS" && <TaskManagementPanel tasks={data.tasks} />}

      {data && activeTab === "ANALYTICS" && <ExecutionAnalyticsPanel data={data} />}
    </div>
  );
}
