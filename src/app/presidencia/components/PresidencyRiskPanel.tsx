"use client";

import React from "react";
import { AlertOctagon } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyRiskPanelProps {
  riscos: PresidencyDashboardData["riscosEstrategicos"];
  loading?: boolean;
}

export const PresidencyRiskPanel: React.FC<PresidencyRiskPanelProps> = ({ riscos, loading = false }) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
          <AlertOctagon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Riscos Estratégicos Prioritários</h3>
          <p className="text-[11px] text-muted-foreground">Alertas críticos consolidados para a Diretoria</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {riscos.slice(0, 4).map((risk) => (
          <div
            key={risk.id}
            className="p-3 bg-background border border-border rounded-xl flex items-center justify-between text-xs font-mono"
          >
            <div className="space-y-0.5">
              <span className="font-bold text-foreground font-sans block">{risk.titulo}</span>
              <span className="text-[11px] text-muted-foreground font-sans block">{risk.descricao}</span>
            </div>

            <div className="text-right shrink-0">
              <span className="text-rose-500 font-bold block">-{formatCur(risk.impactoR$)}</span>
              <span className="text-[10px] text-muted-foreground font-sans">{risk.origem}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
