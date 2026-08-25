"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, LayoutDashboard, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CockpitComercialData } from "@/lib/governance/analytics/engine";
import { CockpitFilterBar, CockpitFiltersState } from "./components/CockpitFilterBar";
import { ExecutiveKpis } from "./components/ExecutiveKpis";
import { FollowUpEfetividadeCard } from "./components/FollowUpEfetividadeCard";
import { SaudeCarteiraGrid } from "./components/SaudeCarteiraGrid";
import { RankingComercialTabs } from "./components/RankingComercialTabs";
import { OportunidadesEngine } from "./components/OportunidadesEngine";

export default function CockpitComercialPage() {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultCurrentMonth = `${defaultYear}-${defaultMonth}`;

  const initialFilters: CockpitFiltersState = {
    startMonth: defaultCurrentMonth,
    endMonth: defaultCurrentMonth,
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<CockpitFiltersState>(initialFilters);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CockpitComercialData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCockpitData = useCallback(async (currentFilters: CockpitFiltersState) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (currentFilters.startMonth) params.set("startMonth", currentFilters.startMonth);
      if (currentFilters.endMonth) params.set("endMonth", currentFilters.endMonth);
      if (currentFilters.manager && currentFilters.manager !== "all") params.set("manager", currentFilters.manager);
      if (currentFilters.uf && currentFilters.uf !== "all") params.set("uf", currentFilters.uf);
      if (currentFilters.channel && currentFilters.channel !== "all") params.set("channel", currentFilters.channel);
      if (currentFilters.matriz && currentFilters.matriz !== "all") params.set("matriz", currentFilters.matriz);

      const res = await fetch(`/api/inovacoes/cockpit?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error("Usuário não autenticado.");
        if (res.status === 403) throw new Error("Acesso negado ao módulo de Vendas.");
        throw new Error(`Falha na resposta do servidor (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error(json.error || "Dados não encontrados.");
      }
    } catch (err: any) {
      console.error("Erro ao carregar Cockpit Comercial:", err);
      setError(err.message || "Ocorreu um erro ao carregar o Cockpit Comercial.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCockpitData(filters);
  }, [filters, fetchCockpitData]);

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  const defaultMetrics: CockpitComercialData["metrics"] = data?.metrics || {
    faturamentoAtual: 0,
    faturamentoAnterior: 0,
    crescimentoNominal: 0,
    crescimentoPercentual: 0,
    clientesAtivos: 0,
    clientesAtencao: 0,
    clientesInativos: 0,
    ticketMedio: 0,
  };

  const defaultSaude = data?.saudeCarteira || [];
  const defaultRanking = data?.ranking || { redes: [], clientes: [], gerentes: [] };
  const defaultOportunidades = data?.oportunidades || [];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="p-1.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Voltar para a Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/10 text-gold border border-gold/20 uppercase tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Sistema Inovações
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Governança Ativa
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            Cockpit Comercial
          </h1>
          <p className="text-xs text-muted-foreground">
            Camada executiva de inteligência para acompanhamento em tempo real da saúde da carteira, faturamento e oportunidades.
          </p>
        </div>

        {/* Botão de Atualizar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchCockpitData(filters)}
            disabled={loading}
            className="px-4 py-2 bg-gold hover:bg-gold-hover text-gold-foreground font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "Atualizando..." : "Atualizar Dados"}</span>
          </button>
        </div>
      </div>

      {/* Alerta de Erro se houver */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-xs flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => fetchCockpitData(filters)}
            className="underline font-bold hover:text-rose-400"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Barra de Filtros Dinâmicos */}
      <CockpitFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Seção 1: KPIs Executivos */}
      <ExecutiveKpis metrics={defaultMetrics} loading={loading} />

      {/* Seção 1.5: Card Executivo de Efetividade do Follow-up Comercial */}
      <FollowUpEfetividadeCard data={(data as any)?.followUpEfetividade} loading={loading} />

      {/* Seção 2: Saúde da Carteira e Ranking Comercial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SaudeCarteiraGrid data={defaultSaude} loading={loading} />
        <RankingComercialTabs ranking={defaultRanking} loading={loading} />
      </div>

      {/* Seção 3: Motor de Oportunidades Comerciais */}
      <OportunidadesEngine oportunidades={defaultOportunidades} loading={loading} />
    </div>
  );
}
