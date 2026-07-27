"use client";

import React from "react";
import { Zap } from "lucide-react";
import { SimulationImpact } from "@/lib/governance/analytics/simulation";

interface SimulationROIProps {
  impacto: SimulationImpact;
  loading?: boolean;
}

export const SimulationROI: React.FC<SimulationROIProps> = ({
  impacto,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Retorno sobre Investimento (ROI)</h3>
            <p className="text-[11px] text-muted-foreground">Eficiência financeira do aporte comercial</p>
          </div>
        </div>

        <span className="text-2xl font-black font-mono text-emerald-500 bg-emerald-500/10 px-4 py-1 rounded-2xl border border-emerald-500/20">
          +{impacto.roiSimuladoPct}% ROI
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Cada R$ 1,00 aplicado neste cenário gera <strong>R$ {(impacto.roiSimuladoPct / 100).toFixed(2)}</strong> de retorno direto sobre a margem de contribuição MACO.
      </p>
    </div>
  );
};
