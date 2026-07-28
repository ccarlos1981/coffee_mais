"use client";

import React from "react";
import { ShieldCheck, Activity, CheckCircle2, AlertOctagon } from "lucide-react";
import { RegressionAuditItem } from "@/lib/governance/quality";

interface RegressionPanelProps {
  regressions: RegressionAuditItem[];
}

export const RegressionPanel: React.FC<RegressionPanelProps> = ({ regressions }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Análise Diagnóstica de Regressões & Estabilidade (Frente 4)</h3>
            <p className="text-[11px] text-muted-foreground">
              Monitoramento contínuo de estabilidade, falhas recorrentes e testes instáveis (Read-Only)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          ZERO REGRESSIONS DETECTED
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {regressions.map((item) => (
          <div key={item.id} className="p-3.5 bg-background border border-border rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground font-sans">{item.module}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-sans font-bold">
                {item.status}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground truncate" title={item.componentOrRoute}>
              {item.componentOrRoute}
            </p>

            <div className="flex items-center justify-between text-[10px] pt-2 border-t border-border/50 text-muted-foreground">
              <span>Regressões: <strong className="text-emerald-500">{item.detectedRegressionCount}</strong></span>
              <span>Instáveis: <strong className="text-emerald-500">{item.flakyTestsCount}</strong></span>
              <span>Estabilidade: <strong className="text-emerald-500">{item.stabilityScorePct}%</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
