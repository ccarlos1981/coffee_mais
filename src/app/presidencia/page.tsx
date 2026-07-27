"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Crown, ShieldCheck, AlertTriangle, Lightbulb } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";
import { PresidencyHeader, PresidencyFiltersState } from "./components/PresidencyHeader";
import { PresidencyKpis } from "./components/PresidencyKpis";
import { PresidencyFinancialPanel } from "./components/PresidencyFinancialPanel";
import { PresidencyCommercialHealth } from "./components/PresidencyCommercialHealth";
import { PresidencyRiskPanel } from "./components/PresidencyRiskPanel";
import { PresidencyOpportunityPanel } from "./components/PresidencyOpportunityPanel";
import { PresidencyScenarioPanel } from "./components/PresidencyScenarioPanel";
import { PresidencyAssistantPanel } from "./components/PresidencyAssistantPanel";
import { PresidencyDrawer } from "./components/PresidencyDrawer";

export default function PainelPresidenciaPage() {
  const defaultFilters: PresidencyFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<PresidencyFiltersState>(defaultFilters);
  const [data, setData] = useState<PresidencyDashboardData | null>(null);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPresidencyData = useCallback(async () => {
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

      const res = await fetch(`/api/presidencia?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro ao carregar Painel Presidência (${res.status})`);
      }

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao processar dados presidenciais.");
      }

      setData(json.data);
    } catch (err: any) {
      console.error("Erro no Painel Presidência:", err);
      setError(err.message || "Erro de conexão com a API da Presidência.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPresidencyData();
  }, [fetchPresidencyData]);

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
            <span className="text-foreground font-semibold">Painel Presidência</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Painel Presidência — Visão Única da Diretoria
              </h1>
              <p className="text-xs text-muted-foreground">
                Consolidação Executiva dos Módulos Analíticos Homologados do Coffee++
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            PRESIDENCY_DASHBOARD = ISOLATED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <PresidencyHeader
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
            type="button"
            onClick={fetchPresidencyData}
            className="px-3 py-1 bg-rose-500 text-white font-bold rounded-xl text-xs"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 3. Banner de Resumo Executivo da Diretoria */}
      {data?.resumoPresidencial && (
        <div className="bg-gradient-to-r from-stone-900 to-stone-950 border border-gold/30 rounded-2xl p-5 shadow-xl text-stone-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gold">
              <Lightbulb className="w-5 h-5" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Diagnóstico Direto da Presidência</h3>
            </div>
            <span className="text-xs font-mono font-bold bg-gold/10 text-gold px-3 py-1 rounded-full border border-gold/20">
              Saúde do Negócio: {data.resumoPresidencial.saudeNegocioPct}/100
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
            <div className="space-y-1 bg-white/5 border border-white/10 p-3 rounded-xl">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-bold">Posição Executiva</span>
              <p className="text-stone-200 leading-relaxed">{data.resumoPresidencial.posicaoExecutiva}</p>
            </div>
            <div className="space-y-1 bg-gold/10 border border-gold/20 p-3 rounded-xl text-gold">
              <span className="text-[10px] text-gold/80 uppercase tracking-wider font-bold">Decisão Recomendada Hoje</span>
              <p className="font-semibold leading-relaxed">{data.resumoPresidencial.decisaoRecomendadaHoje}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. KPIs do Topo */}
      {data?.kpisTopo && <PresidencyKpis kpis={data.kpisTopo} loading={loading} />}

      {/* 5. Painel Financeiro & Saúde Comercial */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PresidencyFinancialPanel visaoFinanceira={data.visaoFinanceira} loading={loading} />
          <PresidencyCommercialHealth saudeComercial={data.saudeComercial} loading={loading} />
        </div>
      )}

      {/* 6. Riscos & Oportunidades em Duas Colunas */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PresidencyRiskPanel riscos={data.riscosEstrategicos} loading={loading} />
          <PresidencyOpportunityPanel oportunidades={data.oportunidadesEstrategicas} loading={loading} />
        </div>
      )}

      {/* 7. Cenário Simulado Recomendado */}
      {data?.melhorCenarioSimulado && (
        <PresidencyScenarioPanel cenario={data.melhorCenarioSimulado} loading={loading} />
      )}

      {/* 8. Insights IA do Assistente */}
      {data?.insightsIA && (
        <PresidencyAssistantPanel insights={data.insightsIA} loading={loading} />
      )}

      {/* 9. Drawer Lateral Read-Only */}
      <PresidencyDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
