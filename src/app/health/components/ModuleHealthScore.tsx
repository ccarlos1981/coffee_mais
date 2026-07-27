"use client";

import React from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { ModuleHealthScoreItem } from "@/lib/governance/observability/metrics";

interface ModuleHealthScoreProps {
  scores: ModuleHealthScoreItem[];
}

export const ModuleHealthScore: React.FC<ModuleHealthScoreProps> = ({ scores }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Health Score por Módulo Comercial (0–100)</h3>
          <p className="text-[11px] text-muted-foreground">Monitoramento individual de disponibilidade e resposta</p>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          8/8 Módulos Operacionais
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        {scores.map((item) => (
          <div key={item.module} className="p-3 bg-background border border-border rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground font-sans">{item.name}</span>
              <span className="text-emerald-500 font-bold text-sm">{item.score}/100</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Latência: {item.latencyMs}ms</span>
              <span>Uptime: {item.availabilityPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
