"use client";

import React from "react";
import { BarChart3, Activity, Award } from "lucide-react";
import { CommercialPlanningData } from "@/lib/commercial-planning";

interface PlanningAnalyticsPanelProps {
  data: CommercialPlanningData;
}

export const PlanningAnalyticsPanel: React.FC<PlanningAnalyticsPanelProps> = ({ data }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analytics de Aderência Executiva do S&OP</h3>
          <p className="text-[11px] text-muted-foreground">
            Indicadores de governança técnica do processo de planejamento integrado
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <span className="text-[10px] text-muted-foreground font-sans font-bold uppercase block">
            Índice de Aderência ao Plano Oficial
          </span>
          <div className="text-2xl font-mono font-bold text-indigo-500">
            {data.kpis.planAdherencePct}%
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Média de conformidade entre a projeção mensal e o plano aprovado pela diretoria.
          </p>
        </div>

        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <span className="text-[10px] text-muted-foreground font-sans font-bold uppercase block">
            Cobertura do Plano de Trade
          </span>
          <div className="text-2xl font-mono font-bold text-emerald-500">
            100% Alocado
          </div>
          <p className="text-[11px] text-muted-foreground font-sans">
            Toda a verba de investimentos comerciais está vinculada a planos de ação rastreáveis.
          </p>
        </div>
      </div>
    </div>
  );
};
