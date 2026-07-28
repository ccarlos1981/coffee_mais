"use client";

import React from "react";
import { CheckSquare, DollarSign, User, Calendar } from "lucide-react";
import { StrategicActionItem } from "@/lib/commercial-planning";

interface ActionPlanOrchestratorPanelProps {
  strategicActions: StrategicActionItem[];
}

export const ActionPlanOrchestratorPanel: React.FC<ActionPlanOrchestratorPanelProps> = ({
  strategicActions,
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Orquestrador de Planos de Ação Estratégicos</h3>
            <p className="text-[11px] text-muted-foreground">
              Ações operacionais atreladas ao cumprimento do Plano Comercial Oficial
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          {strategicActions.length} Ações Orquestradas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {strategicActions.map((act) => (
          <div key={act.id} className="p-4 bg-background border border-border rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-muted text-indigo-500 font-mono font-bold text-[9px] uppercase border border-border/40">
                {act.category}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">{act.dueDate}</span>
            </div>

            <h4 className="text-xs font-bold text-foreground line-clamp-2">{act.title}</h4>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">Responsável: <strong className="text-foreground">{act.owner}</strong></span>
              <span className="text-gold font-bold">{formatCurrency(act.allocatedBudget)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
