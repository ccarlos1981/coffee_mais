"use client";

import React from "react";
import { TrendingUp, PieChart, ShieldAlert, Award, DollarSign } from "lucide-react";
import { CommercialIntelligenceData } from "@/lib/governance/analytics/intelligence";

interface InteligenciaKpisProps {
  kpis: CommercialIntelligenceData["kpis"];
  cockpitSummary: CommercialIntelligenceData["cockpitSummary"];
  loading?: boolean;
}

export const InteligenciaKpis: React.FC<InteligenciaKpisProps> = ({
  kpis,
  cockpitSummary,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Receita Líquida Consolidada */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Faturamento Consolidado</span>
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(kpis.faturamentoConsolidado)}
            </h2>
          )}
          <p className="text-[11px] font-mono text-emerald-500 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Crescimento Nom.: {formatCur(cockpitSummary.crescimentoNominal)} ({cockpitSummary.crescimentoPercentual.toFixed(1)}%)
          </p>
        </div>
      </div>

      {/* KPI 2: MACO Total & Margem % */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">MACO & Margem Global</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-emerald-500 font-mono tracking-tight">
                {formatCur(kpis.macoConsolidado)}
              </h2>
              <span className="text-xs font-bold text-foreground font-mono">
                ({kpis.margemMacoGlobalPct.toFixed(1)}%)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Margem de Contribuição Comercial Apurada
          </p>
        </div>
      </div>

      {/* KPI 3: Potencial de Recuperação do Radar */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Potencial do Radar</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-blue-500 font-mono tracking-tight">
              {formatCur(kpis.potencialImpactoTotal)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {kpis.totalOportunidadesRadar} Oportunidades no Radar
          </p>
        </div>
      </div>

      {/* KPI 4: Saúde Global & Carteira */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Saúde Global & Clientes</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
                {kpis.scoreSaudeGlobalCarteira}/100
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                ({kpis.totalClientesAnalisados} clientes)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Ativos: {cockpitSummary.clientesAtivos} | Em Risco: {cockpitSummary.clientesEmRisco}
          </p>
        </div>
      </div>
    </div>
  );
};
