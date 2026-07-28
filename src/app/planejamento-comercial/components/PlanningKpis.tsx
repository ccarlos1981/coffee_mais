"use client";

import React from "react";
import { DollarSign, Target, TrendingUp, Activity, Calendar, CheckCircle2 } from "lucide-react";
import { PlanningKpisData } from "@/lib/commercial-planning";

interface PlanningKpisProps {
  kpis: PlanningKpisData;
}

export const PlanningKpis: React.FC<PlanningKpisProps> = ({ kpis }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Plano Oficial R$</span>
          <DollarSign className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {formatCurrency(kpis.officialPlanRevenue)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Consolidado do ciclo</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Meta Q3 Consolidada</span>
          <Target className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {formatCurrency(kpis.consolidatedTargetRevenue)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Objetivo da companhia</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Lacuna / Gap R$</span>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          +{formatCurrency(Math.abs(kpis.targetGapAmount))}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Superavit do plano</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Verba Trade Alocada</span>
          <DollarSign className="w-4 h-4 text-gold" />
        </div>
        <div className="text-lg font-mono font-bold text-gold">
          {formatCurrency(kpis.allocatedTradeBudget)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Investimento em campanhas</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Aderência S&OP</span>
          <Activity className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-lg font-mono font-bold text-indigo-500">
          {kpis.planAdherencePct}%
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Execução vs Planejado</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Fase Atual</span>
          <Calendar className="w-4 h-4 text-indigo-500" />
        </div>
        <div className="text-xs font-sans font-bold text-foreground truncate pt-1">
          {kpis.activeCyclePhase}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Status do fluxo</span>
      </div>
    </div>
  );
};
