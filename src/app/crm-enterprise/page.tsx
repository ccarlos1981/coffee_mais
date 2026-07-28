"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Building2, Layers, GitCommit, Clock, CheckSquare, BarChart3, AlertTriangle, ShieldCheck } from "lucide-react";
import { CrmEnterpriseData, CrmFilterOptions } from "@/lib/crm-enterprise";

import { CrmFilterBar } from "./components/CrmFilterBar";
import { CrmEnterpriseKpis } from "./components/CrmEnterpriseKpis";
import { CrmPipelineKanban } from "./components/CrmPipelineKanban";
import { CrmCadastroUnificadoPanel } from "./components/CrmCadastroUnificadoPanel";
import { CrmTimelinePanel } from "./components/CrmTimelinePanel";
import { CrmPlanoAcaoPanel } from "./components/CrmPlanoAcaoPanel";
import { CrmAnalyticsDashboard } from "./components/CrmAnalyticsDashboard";

type CrmTab = "KANBAN" | "CADASTRO" | "TIMELINE" | "PLANOS_ACAO" | "ANALYTICS";

export default function CrmEnterprisePage() {
  const [data, setData] = useState<CrmEnterpriseData | null>(null);
  const [activeTab, setActiveTab] = useState<CrmTab>("KANBAN");
  const [filters, setFilters] = useState<CrmFilterOptions>({
    gerente: "TODOS",
    regional: "TODAS",
    periodo: "MÊS ATUAL",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (filters.gerente) query.append("gerente", filters.gerente);
      if (filters.regional) query.append("regional", filters.regional);
      if (filters.periodo) query.append("periodo", filters.periodo);

      const res = await fetch(`/api/crm-enterprise?${query.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados do CRM Comercial Enterprise.");

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Falha na resposta do servidor.");

      setData(json.data);
    } catch (err: any) {
      console.error("Erro no CRM Enterprise:", err);
      setError(err.message || "Erro de conexão com o servidor do CRM.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCrmData();
  }, [fetchCrmData]);

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
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">CRM Comercial Enterprise (Sprint 3.1)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                CRM Comercial Enterprise — Ciclo 3
              </h1>
              <p className="text-xs text-muted-foreground">
                Plataforma corporativa unificada de gestão comercial, pipeline em 9 estágios, timeline e planos de ação
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              CRM_ENTERPRISE = ACTIVE
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
            onClick={fetchCrmData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros Executivos */}
      <CrmFilterBar
        filters={filters}
        onFilterChange={setFilters}
        loading={loading}
        onRefresh={fetchCrmData}
      />

      {/* Cards de KPIs Executivos */}
      {data?.kpis && <CrmEnterpriseKpis kpis={data.kpis} />}

      {/* Seletor de Abas da Interface */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("KANBAN")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "KANBAN"
              ? "bg-gold text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Pipeline Comercial (Kanban 9 Estágios)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("CADASTRO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "CADASTRO"
              ? "bg-gold text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Cadastro Unificado
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TIMELINE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "TIMELINE"
              ? "bg-gold text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Clock className="w-4 h-4" />
          Timeline Comercial
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PLANOS_ACAO")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "PLANOS_ACAO"
              ? "bg-gold text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Planos de Ação
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ANALYTICS"
              ? "bg-gold text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics & Ranking
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {data && activeTab === "KANBAN" && (
        <CrmPipelineKanban
          opportunities={data.opportunities}
          pipelineByStage={data.pipelineByStage}
          stageLabels={data.stageLabels}
          onRefresh={fetchCrmData}
        />
      )}

      {data && activeTab === "CADASTRO" && (
        <CrmCadastroUnificadoPanel customers={data.customers} />
      )}

      {data && activeTab === "TIMELINE" && (
        <CrmTimelinePanel timeline={data.timeline} />
      )}

      {data && activeTab === "PLANOS_ACAO" && (
        <CrmPlanoAcaoPanel actionPlans={data.actionPlans} />
      )}

      {data && activeTab === "ANALYTICS" && (
        <CrmAnalyticsDashboard data={data} />
      )}
    </div>
  );
}
