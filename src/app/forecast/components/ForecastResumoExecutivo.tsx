"use client";

import React from "react";
import { TrendingUp, Target, DollarSign, PieChart } from "lucide-react";
import { ForecastFaturamento, ForecastRentabilidade } from "@/lib/governance/analytics/forecast";

interface ForecastResumoExecutivoProps {
  faturamento: ForecastFaturamento;
  rentabilidade: ForecastRentabilidade;
  loading?: boolean;
}

export const ForecastResumoExecutivo: React.FC<ForecastResumoExecutivoProps> = ({
  faturamento,
  rentabilidade,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Realizado até o Momento */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Faturamento Realizado</span>
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(faturamento.realizado)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Faturamento acumulado apurado no mês
          </p>
        </div>
      </div>

      {/* 2. Forecast de Fechamento */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Projeção de Fechamento</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-emerald-500 font-mono tracking-tight">
                {formatCur(faturamento.projetado)}
              </h2>
            </div>
          )}
          <p className="text-[11px] text-emerald-500 font-mono mt-1 font-bold">
            {faturamento.percentualAtingimento}% da Meta Comercial
          </p>
        </div>
      </div>

      {/* 3. Meta & Gap */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Meta Oficial & Gap</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(faturamento.meta)}
            </h2>
          )}
          <p className={`text-[11px] font-mono mt-1 font-bold ${faturamento.gap <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
            {faturamento.gap <= 0 ? "Superação da Meta!" : `Gap: ${formatCur(faturamento.gap)}`}
          </p>
        </div>
      </div>

      {/* 4. MACO Projetado */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">MACO Projetado</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
                {formatCur(rentabilidade.maco)}
              </h2>
              <span className="text-xs font-bold text-emerald-500 font-mono">
                ({rentabilidade.margemMacoPercentual.toFixed(1)}%)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Margem MACO estimada no fechamento
          </p>
        </div>
      </div>
    </div>
  );
};
