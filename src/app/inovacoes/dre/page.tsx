"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, BarChart3, ShieldCheck, RefreshCw, AlertTriangle } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";
import { DreFilterBar, DreFiltersState } from "./components/DreFilterBar";
import { DreResumoExecutivo } from "./components/DreResumoExecutivo";
import { DreSinteticaCard } from "./components/DreSinteticaCard";
import { DreDimensionSelector, DreDimensionType } from "./components/DreDimensionSelector";
import { DreDimensionalGrid } from "./components/DreDimensionalGrid";

export default function DreComercialPage() {
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const defaultFilters: DreFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<DreFiltersState>(defaultFilters);
  const [selectedDimension, setSelectedDimension] = useState<DreDimensionType>("cliente");
  const [dreData, setDreData] = useState<DreComercialData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDreData = useCallback(async () => {
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
      params.set("dimension", selectedDimension);

      const res = await fetch(`/api/inovacoes/dre?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados da DRE Comercial.");
      }
      setDreData(json.data);
    } catch (err: any) {
      console.error("Erro ao carregar DRE Comercial:", err);
      setError(err.message || "Erro de conexão com a API da DRE Comercial.");
    } finally {
      setLoading(false);
    }
  }, [filters, selectedDimension]);

  useEffect(() => {
    fetchDreData();
  }, [fetchDreData]);

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
            <Link href="/inovacoes/cockpit" className="hover:text-foreground transition-colors">
              Inovações
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">DRE Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                DRE Comercial — Rentabilidade & Margem
              </h1>
              <p className="text-xs text-muted-foreground">
                Demonstração de Resultado e Margem de Contribuição (MACO) com Governança Financeira V1
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            ANALYTICS_ENGINE_V1 = LOCKED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <DreFilterBar
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
            onClick={fetchDreData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* 3. Cards de Resumo Executivo */}
      <DreResumoExecutivo
        totais={
          dreData?.totais || {
            faturamentoBruto: 0,
            faturamentoLiquido: 0,
            impostos: 0,
            cpv: 0,
            margemBruta: 0,
            frete: 0,
            investimentoComercial: 0,
            macoTotal: 0,
            margemMacoMedia: 0,
          }
        }
        loading={loading}
      />

      {/* 4. DRE Sintética (P&L Vertical Executivo) */}
      <DreSinteticaCard
        sintetica={dreData?.sintetica || []}
        totais={dreData?.totais}
        dimensionais={dreData?.dimensionais || []}
        period={filters.startMonth}
        loading={loading}
      />

      {/* 5. Seletor de Dimensões & Tabela Dimensional */}
      <div className="space-y-4">
        <DreDimensionSelector
          selectedDimension={selectedDimension}
          onDimensionChange={setSelectedDimension}
          loading={loading}
        />

        <DreDimensionalGrid
          dimensionais={dreData?.dimensionais || []}
          loading={loading}
        />
      </div>
    </div>
  );
}
