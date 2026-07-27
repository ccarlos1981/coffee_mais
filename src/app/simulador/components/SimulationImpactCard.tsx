"use client";

import React from "react";
import { PieChart } from "lucide-react";
import { SimulationImpact } from "@/lib/governance/analytics/simulation";

interface SimulationImpactCardProps {
  impacto: SimulationImpact;
  loading?: boolean;
}

export const SimulationImpactCard: React.FC<SimulationImpactCardProps> = ({
  impacto,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <PieChart className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Impacto na Margem MACO</h3>
          <p className="text-[11px] text-muted-foreground">Efeito líquido da decisão na margem de contribuição</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">MACO Base</span>
          <div className="text-base font-bold text-foreground">{formatCur(impacto.macoOriginal)}</div>
        </div>

        <div className="bg-background border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-emerald-500 font-bold uppercase">MACO Simulado</span>
          <div className="text-base font-bold text-emerald-500">{formatCur(impacto.macoSimulado)}</div>
        </div>

        <div className="bg-background border border-gold/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-gold font-bold uppercase">Ganho de MACO</span>
          <div className="text-base font-bold text-gold">+{formatCur(impacto.diferencaMaco)}</div>
        </div>
      </div>
    </div>
  );
};
