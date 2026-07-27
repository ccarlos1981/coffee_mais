"use client";

import React from "react";
import { Sliders, Sparkles } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyScenarioPanelProps {
  cenario: PresidencyDashboardData["melhorCenarioSimulado"];
  loading?: boolean;
}

export const PresidencyScenarioPanel: React.FC<PresidencyScenarioPanelProps> = ({ cenario, loading = false }) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Melhor Cenário Simulado</h3>
            <p className="text-[11px] text-muted-foreground">Origem: Simulador Comercial (100% Read-Only)</p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-gold/10 text-gold border border-gold/20 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {cenario.nome}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Faturamento Simulado</span>
          <div className="text-sm font-bold text-foreground">{formatCur(cenario.faturamentoSimulado)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Ganho de MACO</span>
          <div className="text-sm font-bold text-emerald-500">+{formatCur(cenario.ganhoMacoR$)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">ROI Estimado</span>
          <div className="text-sm font-bold text-emerald-500">+{cenario.roiPct}%</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Payback</span>
          <div className="text-sm font-bold text-foreground">{cenario.paybackMeses} meses</div>
        </div>
      </div>
    </div>
  );
};
