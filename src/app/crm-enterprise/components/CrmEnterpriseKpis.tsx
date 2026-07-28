"use client";

import React from "react";
import { DollarSign, TrendingUp, Users, AlertTriangle, CheckCircle2, Target } from "lucide-react";
import { CrmKpisData } from "@/lib/crm-enterprise";

interface CrmEnterpriseKpisProps {
  kpis: CrmKpisData;
}

export const CrmEnterpriseKpis: React.FC<CrmEnterpriseKpisProps> = ({ kpis }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Valor Total do Funil */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Valor Funil</span>
          <DollarSign className="w-4 h-4 text-gold" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {formatCurrency(kpis.totalPipelineValue)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Total estimado</span>
      </div>

      {/* Valor Ponderado */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Valor Ponderado</span>
          <Target className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {formatCurrency(kpis.weightedPipelineValue)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Por probabilidade</span>
      </div>

      {/* Oportunidades Ativas */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Oportunidades</span>
          <TrendingUp className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {kpis.activeOpportunitiesCount} Ativas
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Em andamento</span>
      </div>

      {/* Taxa de Conversão */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Taxa Conversão</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {kpis.avgConversionRatePct}%
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Média histórica</span>
      </div>

      {/* Clientes Sem Visita */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Sem Visita (&gt;30d)</span>
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg font-mono font-bold text-amber-500">
          {kpis.customersWithoutVisitCount} Clientes
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Ação necessária</span>
      </div>

      {/* Clientes em Risco */}
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Clientes em Risco</span>
          <AlertTriangle className="w-4 h-4 text-rose-500" />
        </div>
        <div className="text-lg font-mono font-bold text-rose-500">
          {kpis.customersAtRiskCount} Alertas
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Health Score &lt; 75</span>
      </div>
    </div>
  );
};
