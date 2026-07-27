"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { SimulationRiscoOportunidade } from "@/lib/governance/analytics/simulation";

interface SimulationOpportunityCardProps {
  oportunidades: SimulationRiscoOportunidade[];
  onSelect: (item: SimulationRiscoOportunidade) => void;
  loading?: boolean;
}

export const SimulationOpportunityCard: React.FC<SimulationOpportunityCardProps> = ({
  oportunidades,
  onSelect,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Oportunidades de Captura</h3>
          <p className="text-[11px] text-muted-foreground">Ganhos potenciais associados à simulação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {oportunidades.map((op) => (
          <div
            key={op.id}
            onClick={() => onSelect(op)}
            className="bg-background border border-emerald-500/20 rounded-xl p-3.5 space-y-1 hover:border-emerald-500 transition-all cursor-pointer"
          >
            <div className="flex justify-between text-xs">
              <span className="font-bold text-foreground truncate max-w-[200px]">{op.titulo}</span>
              <span className="font-mono font-bold text-emerald-500">+{formatCur(op.impactoR$)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{op.descricao}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
