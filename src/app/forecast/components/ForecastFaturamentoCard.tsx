"use client";

import React from "react";
import { DollarSign, Target, TrendingUp } from "lucide-react";
import { ForecastFaturamento } from "@/lib/governance/analytics/forecast";

interface ForecastFaturamentoCardProps {
  faturamento: ForecastFaturamento;
  loading?: boolean;
}

export const ForecastFaturamentoCard: React.FC<ForecastFaturamentoCardProps> = ({
  faturamento,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Forecast Oficial de Faturamento</h3>
            <p className="text-[11px] text-muted-foreground">Projeção por Run-Rate diário e aceleração sazonal</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20">
          Atingimento: {faturamento.percentualAtingimento}%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Realizado</span>
          <div className="text-lg font-bold text-foreground">{formatCur(faturamento.realizado)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Projetado</span>
          <div className="text-lg font-bold text-emerald-500">{formatCur(faturamento.projetado)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Meta Oficial</span>
          <div className="text-lg font-bold text-foreground">{formatCur(faturamento.meta)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Gap p/ Meta</span>
          <div className={`text-lg font-bold ${faturamento.gap <= 0 ? "text-emerald-500" : "text-amber-500"}`}>
            {faturamento.gap <= 0 ? "0 (Superada)" : formatCur(faturamento.gap)}
          </div>
        </div>
      </div>
    </div>
  );
};
