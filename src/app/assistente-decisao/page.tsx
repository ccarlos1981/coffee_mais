"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Sparkles, Target, ShieldAlert, Trophy, BarChart3, AlertTriangle, ShieldCheck } from "lucide-react";
import { CommercialDecisionData, DecisionFilterOptions } from "@/lib/commercial-decision";

import { DecisionFilterBar } from "./components/DecisionFilterBar";
import { DecisionKpis } from "./components/DecisionKpis";
import { RecommendationsPanel } from "./components/RecommendationsPanel";
import { OpportunityScoringPanel } from "./components/OpportunityScoringPanel";
import { RiskDetectionPanel } from "./components/RiskDetectionPanel";
import { PriorityRankingPanel } from "./components/PriorityRankingPanel";
import { DecisionAnalyticsPanel } from "./components/DecisionAnalyticsPanel";

type DecisionTab = "RECOMENDACOES" | "SCORING" | "RISCOS" | "RANKING" | "ANALYTICS";

export default function CommercialDecisionPage() {
  const [data, setData] = useState<CommercialDecisionData | null>(null);
  const [activeTab, setActiveTab] = useState<DecisionTab>("RECOMENDACOES");
  const [filters, setFilters] = useState<DecisionFilterOptions>({
    gerente: "TODOS",
    nivelRisco: "TODOS",
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecisionData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (filters.gerente) query.append("gerente", filters.gerente);
      if (filters.nivelRisco) query.append("nivelRisco", filters.nivelRisco);

      const res = await fetch(`/api/commercial-decision?${query.toString()}`);
      if (!res.ok) throw new Error("Erro ao carregar dados do Assistente de Decisão.");

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Falha na resposta do servidor.");

      setData(json.data);
    } catch (err: any) {
      console.error("Erro no Assistente de Decisão:", err);
      setError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDecisionData();
  }, [fetchDecisionData]);

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
            <ChevronRight className="w-3 h-3 text-purple-500" />
            <Link href="/crm-enterprise" className="hover:text-foreground transition-colors">
              CRM Comercial Enterprise
            </Link>
            <ChevronRight className="w-3 h-3 text-purple-500" />
            <span className="text-foreground font-semibold">Assistente de Decisão (Sprint 3.3)</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Inteligência Comercial & Assistente de Decisão
              </h1>
              <p className="text-xs text-muted-foreground">
                Suporte analítico à tomada de decisão comercial, recomendações prescritivas, scoring de oportunidades e radar de riscos
              </p>
            </div>
          </div>
        </div>

        {/* Badges de Governança */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              COMMERCIAL_DECISION = ACTIVE
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
            onClick={fetchDecisionData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <DecisionFilterBar
        filters={filters}
        onFilterChange={setFilters}
        loading={loading}
        onRefresh={fetchDecisionData}
      />

      {/* Cards de KPIs */}
      {data?.kpis && <DecisionKpis kpis={data.kpis} />}

      {/* Seletor de Abas */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("RECOMENDACOES")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "RECOMENDACOES"
              ? "bg-purple-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Recomendações Prescritivas
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SCORING")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "SCORING"
              ? "bg-purple-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Target className="w-4 h-4" />
          Scoring de Oportunidades
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RISCOS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "RISCOS"
              ? "bg-purple-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Radar de Riscos
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RANKING")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "RANKING"
              ? "bg-purple-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <Trophy className="w-4 h-4" />
          Ranking de Prioridades
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ANALYTICS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === "ANALYTICS"
              ? "bg-purple-500 text-background shadow-sm"
              : "bg-card hover:bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics da Matriz
        </button>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {data && activeTab === "RECOMENDACOES" && <RecommendationsPanel prescriptions={data.prescriptions} />}

      {data && activeTab === "SCORING" && <OpportunityScoringPanel scores={data.scores} />}

      {data && activeTab === "RISCOS" && <RiskDetectionPanel risks={data.risks} />}

      {data && activeTab === "RANKING" && <PriorityRankingPanel priorities={data.priorities} />}

      {data && activeTab === "ANALYTICS" && <DecisionAnalyticsPanel data={data} />}
    </div>
  );
}
