"use client";

import React from "react";
import { DollarSign, TrendingUp, Sliders, CheckCircle2, Award, Activity } from "lucide-react";
import { ScenarioKpisData } from "@/lib/commercial-scenarios";

interface ScenarioKpisProps {
  kpis: ScenarioKpisData;
}

export const ScenarioKpis: React.FC<ScenarioKpisProps> = ({ kpis }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Base Projetado</span>
          <DollarSign className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {formatCurrency(kpis.baseRevenueProjected)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Fechamento oficial</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Otimista Projetado</span>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {formatCurrency(kpis.bestScenarioRevenueProjected)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">+15% Vendas & Trade</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Delta Potencial</span>
          <TrendingUp className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          +{formatCurrency(kpis.maxProjectedDeltaAmount)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Ganho em receita</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Margem MACO Média</span>
          <Activity className="w-4 h-4 text-gold" />
        </div>
        <div className="text-lg font-mono font-bold text-gold">
          {kpis.avgSimulatedMacoPct}%
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Rentabilidade líquida</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">ROI Trade Estimado</span>
          <Award className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-lg font-mono font-bold text-blue-500">
          {kpis.avgEstimatedRoiRatio}x
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Retorno por R$ investido</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Hipóteses Validadas</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {kpis.validatedPrescriptionsCount} Prescrições
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Testadas na SimulationEngine</span>
      </div>
    </div>
  );
};
