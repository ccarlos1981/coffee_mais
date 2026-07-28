"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, CheckCircle2, ShieldCheck, Cpu } from "lucide-react";
import { DependencyRiskItem } from "@/lib/governance/security";

interface DependencyRiskPanelProps {
  dependencyRisk: DependencyRiskItem[];
}

export const DependencyRiskPanel: React.FC<DependencyRiskPanelProps> = ({ dependencyRisk }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Análise de Risco de Dependências & Supply Chain</h3>
            <p className="text-[11px] text-muted-foreground">
              Painel preparado para integração de feeds de vulnerabilidade (Frente 6)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SUPPLY CHAIN = SAFE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dependencyRisk.map((item) => (
          <div key={item.packageName} className="p-3.5 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground font-mono">{item.packageName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {item.status}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">{item.knownRisk}</p>

            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/50">
              <span>Criticidade: <strong className="text-foreground">{item.criticality}</strong></span>
              <span>Supply Chain: <strong className="text-emerald-500">{item.supplyChainRisk}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
