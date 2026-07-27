"use client";

import React from "react";
import { Activity, Cpu, ShieldCheck, Zap } from "lucide-react";
import { EnterpriseObservabilityMetricsData } from "@/lib/governance/observability/metrics";

interface ObservabilityOverviewProps {
  overview: EnterpriseObservabilityMetricsData["overview"];
}

export const ObservabilityOverview: React.FC<ObservabilityOverviewProps> = ({ overview }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Global Health Score</span>
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.globalHealthScore}/100</div>
        <p className="text-[11px] text-muted-foreground">Maturidade Enterprise Ativa</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Requisições API (24h)</span>
          <Zap className="w-4 h-4 text-gold" />
        </div>
        <div className="text-2xl font-bold text-foreground">{overview.totalApiRequests24h.toLocaleString("pt-BR")}</div>
        <p className="text-[11px] text-muted-foreground">Throughput Estável</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Latência Média Global</span>
          <Cpu className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.avgSystemLatencyMs} ms</div>
        <p className="text-[11px] text-muted-foreground">Desempenho Ultrarrápido</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Disponibilidade Sistema</span>
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.systemAvailabilityPct}%</div>
        <p className="text-[11px] text-muted-foreground">Erros em 24h: {overview.totalErrorsCaptured24h}</p>
      </div>
    </div>
  );
};
