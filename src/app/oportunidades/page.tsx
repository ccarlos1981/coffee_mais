"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Target, ShieldCheck, RefreshCw, AlertTriangle, Zap, Compass, BarChart3, Sliders, MessageSquare } from "lucide-react";
import { CrmComercialData, CrmOportunidade } from "@/lib/governance/analytics/engine";
import { CrmFilterBar, CrmFiltersState } from "../inovacoes/crm/components/CrmFilterBar";
import { CrmResumoExecutivo } from "../inovacoes/crm/components/CrmResumoExecutivo";
import { CrmScoreCard } from "../inovacoes/crm/components/CrmScoreCard";
import { CrmOportunidadesGrid } from "../inovacoes/crm/components/CrmOportunidadesGrid";
import { CrmClienteDrawer } from "../inovacoes/crm/components/CrmClienteDrawer";

export default function CentralOportunidadesPage() {
  const defaultFilters: CrmFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<CrmFiltersState>(defaultFilters);
  const [crmData, setCrmData] = useState<CrmComercialData | null>(null);
  const [selectedOportunidade, setSelectedOportunidade] = useState<CrmOportunidade | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOportunidadesData = useCallback(async () => {
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

      const res = await fetch(`/api/inovacoes/crm?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados da Central de Oportunidades.");
      }
      setCrmData(json.data);
    } catch (err: any) {
      console.error("Erro ao carregar Central de Oportunidades:", err);
      setError(err.message || "Erro de conexão com a API de Oportunidades.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOportunidadesData();
  }, [fetchOportunidadesData]);

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
            <span className="text-foreground font-semibold">Central de Oportunidades</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Central de Oportunidades & Ações Prescritivas
              </h1>
              <p className="text-xs text-muted-foreground">
                Orquestrador Executivo de Recomendações Priorizadas por Score Financeiro Oficial (0 a 100)
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira & Links Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/inteligencia"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Inteligência</span>
          </Link>
          <Link
            href="/forecast"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span>Forecast</span>
          </Link>
          <Link
            href="/simulador"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-all shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-500" />
            <span>Simulador</span>
          </Link>
          <Link
            href="/assistente"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-700 hover:bg-amber-500/20 transition-all shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>Copiloto</span>
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold shadow-sm ml-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Governança 100% Read-Only</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros Homologada */}
      <CrmFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* 3. Tratamento de Estados de Erro */}
      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchOportunidadesData}
            className="px-3 py-1 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 4. Estado de Carregamento Skeleton */}
      {loading && !crmData && (
        <div className="space-y-6 animate-pulse">
          <div className="h-32 bg-card/60 border border-border/50 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-40 bg-card/60 border border-border/50 rounded-2xl" />
            <div className="h-40 bg-card/60 border border-border/50 rounded-2xl" />
            <div className="h-40 bg-card/60 border border-border/50 rounded-2xl" />
          </div>
          <div className="h-96 bg-card/60 border border-border/50 rounded-2xl" />
        </div>
      )}

      {/* 5. Conteúdo Consolidado das Oportunidades */}
      {!loading && crmData && (
        <div className="space-y-6">
          {/* Card 1: Resumo Executivo da Carteira (Faturamento em Risco, Potencial, MACO) */}
          <CrmResumoExecutivo
            resumo={crmData.resumo}
            totalOportunidades={crmData.oportunidades.length}
          />

          {/* Grid de Cards de Metodologia e Distribuição por Gerente */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <CrmScoreCard rankingGerentesScore={crmData.rankingGerentesScore} />
            </div>

            {/* Painel Sintético de Performance de Scores por Gerente */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm text-foreground">
                    Ranking de Efetividade Prescritiva por Gerente
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Score Saúde Médio (0-100)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {crmData.rankingGerentesScore.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-background border border-border flex items-center justify-between shadow-xs hover:border-amber-500/40 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-foreground block">
                        {item.gerente}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {item.totalClientes} clientes na carteira
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-600 block">
                        Score {item.scoreSaude.toFixed(1)}
                      </span>
                      <span className="text-[9px] font-semibold text-emerald-600">
                        {item.oportunidadesPrioritarias} ações prioritárias
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-[10px] text-muted-foreground text-center bg-muted/30 p-2 rounded-xl border border-border/50">
                💡 O Score Comercial é calculado deterministicamente pela AnalyticsEngine combinando Impacto Financeiro (40%), Criticidade (30%), Relevância (20%) e Urgência (10%).
              </div>
            </div>
          </div>

          {/* Grid Interativa de Oportunidades Priorizadas */}
          <CrmOportunidadesGrid
            oportunidades={crmData.oportunidades}
            onSelectOportunidade={(op) => setSelectedOportunidade(op)}
          />
        </div>
      )}

      {/* 6. Drawer Executivo de Detalhamento 360° do Cliente */}
      <CrmClienteDrawer
        oportunidade={selectedOportunidade}
        onClose={() => setSelectedOportunidade(null)}
      />
    </div>
  );
}
