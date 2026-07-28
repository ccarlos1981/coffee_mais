"use client";

import React from "react";
import { Sparkles, ShieldAlert, DollarSign, CheckCircle2, Award, Cpu } from "lucide-react";
import { DecisionKpisData } from "@/lib/commercial-decision";

interface DecisionKpisProps {
  kpis: DecisionKpisData;
}

export const DecisionKpis: React.FC<DecisionKpisProps> = ({ kpis }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Health Score Carteira</span>
          <Award className="w-4 h-4 text-purple-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {kpis.avgPortfolioHealthScore}/100
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Saúde média das contas</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Oportunidades Críticas</span>
          <ShieldAlert className="w-4 h-4 text-rose-500" />
        </div>
        <div className="text-lg font-mono font-bold text-rose-500">
          {kpis.criticalOpportunitiesCount} Críticas
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Exigem ação imediata</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Potencial Protegido</span>
          <DollarSign className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {formatCurrency(kpis.totalProtectedRevenue)}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Impacto financeiro estimado</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Recomendações</span>
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {kpis.prescriptionsGeneratedCount} Prescrições
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Ações sugeridas pelo motor</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Alertas de Risco</span>
          <ShieldAlert className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg font-mono font-bold text-amber-500">
          {kpis.highRiskCustomersCount} Alertas
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Risco de churn / queda</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Confiança do Modelo</span>
          <Cpu className="w-4 h-4 text-purple-500" />
        </div>
        <div className="text-lg font-mono font-bold text-purple-500">
          {kpis.avgModelConfidencePct}%
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Precisão das sugestões</span>
      </div>
    </div>
  );
};
