"use client";

import React from "react";
import { BarChart3, HardDrive } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";

interface PerformanceTelemetryPanelProps {
  telemetry: EnterpriseHealthReport["telemetry"];
  performance: EnterpriseHealthReport["performanceMetrics"];
}

export const PerformanceTelemetryPanel: React.FC<PerformanceTelemetryPanelProps> = ({
  telemetry,
  performance,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Telemetria de Uso & Consumo de Memória</h3>
            <p className="text-[11px] text-muted-foreground">Métricas operacionais capturadas em tempo de execução</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-background px-3 py-1 rounded-xl border border-border">
          <HardDrive className="w-3.5 h-3.5 text-gold" />
          <span>Heap Memory: {performance.memoryUsageMb} MB</span>
        </div>
      </div>

      <div className="space-y-2 font-mono text-xs">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-sans font-bold">
          Módulos Mais Acessados (Últimas 24h)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {telemetry.topModulesAccessed.map((mod, idx) => (
            <div key={idx} className="p-2.5 bg-background border border-border rounded-xl flex items-center justify-between">
              <span className="text-foreground">{mod.name}</span>
              <span className="text-emerald-500 font-bold">{mod.count} req</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
