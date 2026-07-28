"use client";

import React from "react";
import { BarChart3, Cpu, Sparkles, TrendingUp } from "lucide-react";
import { CommercialDecisionData } from "@/lib/commercial-decision";

interface DecisionAnalyticsPanelProps {
  data: CommercialDecisionData;
}

export const DecisionAnalyticsPanel: React.FC<DecisionAnalyticsPanelProps> = ({ data }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analytics da Matriz de Decisão Comercial</h3>
          <p className="text-[11px] text-muted-foreground">
            Métricas de desempenho do modelo estatístico e matriz cruzada Impacto vs Urgência
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Matriz Impacto */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Precisão do Modelo Preditivo</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-purple-500">
            {data.kpis.avgModelConfidencePct}%
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Grau de alinhamento histórico das prescrições com os resultados de vendas
          </p>
        </div>

        {/* Portfólio em Risco */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Alertas de Risco Mitigados</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-500">
            {data.risks.length} Diagnósticos
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Contas monitoradas com mitigação proativa sugerida pelo motor
          </p>
        </div>

        {/* Fatores do Algoritmo */}
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Composição do Scoring</span>
            <TrendingUp className="w-4 h-4 text-purple-500" />
          </div>
          <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
            <div className="flex justify-between">
              <span>Impacto Financeiro:</span>
              <strong className="text-foreground">40% peso</strong>
            </div>
            <div className="flex justify-between">
              <span>Probabilidade de Fechamento:</span>
              <strong className="text-foreground">30% peso</strong>
            </div>
            <div className="flex justify-between">
              <span>Urgência Temporal:</span>
              <strong className="text-foreground">20% peso</strong>
            </div>
            <div className="flex justify-between">
              <span>Relevância Estratégica:</span>
              <strong className="text-foreground">10% peso</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
