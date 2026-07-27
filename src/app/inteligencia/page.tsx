"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Globe2, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { CommercialIntelligenceData, IntelligenceOpportunityRadar } from "@/lib/governance/analytics/intelligence";
import { InteligenciaFilterBar, InteligenciaFiltersState } from "./components/InteligenciaFilterBar";
import { InteligenciaKpis } from "./components/InteligenciaKpis";
import { InteligenciaRadarGrid } from "./components/InteligenciaRadarGrid";
import { InteligenciaRegionalScore } from "./components/InteligenciaRegionalScore";
import { InteligenciaDrawer } from "./components/InteligenciaDrawer";

export default function CentroInteligenciaPage() {
  const defaultFilters: InteligenciaFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<InteligenciaFiltersState>(defaultFilters);
  const [data, setData] = useState<CommercialIntelligenceData | null>(null);
  const [selectedRadar, setSelectedRadar] = useState<IntelligenceOpportunityRadar | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligenceData = useCallback(async () => {
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

      const res = await fetch(`/api/inteligencia?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados do Centro de Inteligência Comercial.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error("Erro ao carregar Centro de Inteligência Comercial:", err);
      setError(err.message || "Erro de conexão com a API do Centro de Inteligência.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIntelligenceData();
  }, [fetchIntelligenceData]);

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
            <span className="text-foreground font-semibold">Centro de Inteligência Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Globe2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Centro de Inteligência Comercial
              </h1>
              <p className="text-xs text-muted-foreground">
                Módulo Analítico Independente para Governança & Estratégia Comercial
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            COMMERCIAL_INTELLIGENCE = ISOLATED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <InteligenciaFilterBar
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
            onClick={fetchIntelligenceData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3. Cards Executivos */}
      <InteligenciaKpis
        kpis={
          data?.kpis || {
            faturamentoConsolidado: 0,
            macoConsolidado: 0,
            margemMacoGlobalPct: 0,
            scoreSaudeGlobalCarteira: 0,
            totalClientesAnalisados: 0,
            totalOportunidadesRadar: 0,
            potencialImpactoTotal: 0,
          }
        }
        cockpitSummary={
          data?.cockpitSummary || {
            crescimentoNominal: 0,
            crescimentoPercentual: 0,
            clientesAtivos: 0,
            clientesEmRisco: 0,
          }
        }
        loading={loading}
      />

      {/* 4. Radar Estratégico de Inteligência */}
      <InteligenciaRadarGrid
        radarOportunidades={data?.radarOportunidades || []}
        onSelectRadar={setSelectedRadar}
        loading={loading}
      />

      {/* 5. Score por Território / Região */}
      <InteligenciaRegionalScore
        desempenhoRegional={data?.desempenhoRegional || []}
        loading={loading}
      />

      {/* 6. Drawer Lateral Read-Only */}
      <InteligenciaDrawer
        item={selectedRadar}
        onClose={() => setSelectedRadar(null)}
      />
    </div>
  );
}
