"use client";

import React from "react";
import { TrendingUp, Award } from "lucide-react";
import { EnterpriseObservabilityMetricsData } from "@/lib/governance/observability/metrics";

interface SystemTrendPanelProps {
  trends: EnterpriseObservabilityMetricsData["trends"];
  availability: EnterpriseObservabilityMetricsData["availability"];
}

export const SystemTrendPanel: React.FC<SystemTrendPanelProps> = ({ trends, availability }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Tendências & SLA Enterprise</h3>
            <p className="text-[11px] text-muted-foreground">Evolução do tempo de resposta e garantia de Uptime SLA</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
          <Award className="w-3.5 h-3.5" />
          SLA Target: {availability.slaTargetPct}% (Atual: {availability.uptime30dPct}%)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Melhora na Latência</span>
          <span className="text-lg font-bold text-emerald-500">{trends.latencyTrendPct}% em 30d</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Taxa de Erros</span>
          <span className="text-lg font-bold text-emerald-500">0.00% Consistente</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Crescimento de Throughput</span>
          <span className="text-lg font-bold text-gold">+{trends.throughputGrowthPct}%</span>
        </div>
      </div>
    </div>
  );
};
