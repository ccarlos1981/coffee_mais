"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { ForecastRiscoOportunidade } from "@/lib/governance/analytics/forecast";

interface ForecastRiscosCardProps {
  riscos: ForecastRiscoOportunidade[];
  onSelect: (item: ForecastRiscoOportunidade) => void;
  loading?: boolean;
}

export const ForecastRiscosCard: React.FC<ForecastRiscosCardProps> = ({
  riscos,
  onSelect,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Riscos Críticos de Fechamento</h3>
          <p className="text-[11px] text-muted-foreground">Fatores que podem comprometer o atingimento da meta</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {riscos.map((r) => (
          <div
            key={r.id}
            onClick={() => onSelect(r)}
            className="bg-background border border-rose-500/20 rounded-xl p-3.5 space-y-1 hover:border-rose-500 transition-all cursor-pointer"
          >
            <div className="flex justify-between text-xs">
              <span className="font-bold text-foreground truncate max-w-[200px]">{r.titulo}</span>
              <span className="font-mono font-bold text-rose-500">-{formatCur(r.impactoEstimado)}</span>
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1">{r.descricao}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
