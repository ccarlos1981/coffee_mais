"use client";

import React from "react";
import { Zap } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyOpportunityPanelProps {
  oportunidades: PresidencyDashboardData["oportunidadesEstrategicas"];
  loading?: boolean;
}

export const PresidencyOpportunityPanel: React.FC<PresidencyOpportunityPanelProps> = ({
  oportunidades,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Oportunidades de Alto Impacto</h3>
          <p className="text-[11px] text-muted-foreground">Ações comerciais prioritárias recomendadas</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {oportunidades.slice(0, 4).map((op) => (
          <div
            key={op.id}
            className="p-3 bg-background border border-border rounded-xl flex items-center justify-between text-xs font-mono"
          >
            <div className="space-y-0.5">
              <span className="font-bold text-foreground font-sans block">{op.titulo}</span>
              <span className="text-[11px] text-muted-foreground font-sans block">{op.descricao}</span>
            </div>

            <div className="text-right shrink-0">
              <span className="text-emerald-500 font-bold block">+{formatCur(op.impactoR$)}</span>
              <span className="text-[10px] text-muted-foreground font-sans">{op.origem}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
