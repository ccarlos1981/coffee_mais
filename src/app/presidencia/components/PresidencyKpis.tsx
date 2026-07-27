"use client";

import React from "react";
import { PresidencyKpiItem } from "@/lib/governance/analytics/presidency";

interface PresidencyKpisProps {
  kpis: PresidencyKpiItem[];
  loading?: boolean;
}

export const PresidencyKpis: React.FC<PresidencyKpisProps> = ({ kpis, loading = false }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.id}
          className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all space-y-2"
        >
          <span className="text-xs font-semibold text-muted-foreground block">{kpi.label}</span>
          <div className="text-2xl font-bold font-mono tracking-tight text-foreground">{kpi.value}</div>
          <p className="text-[11px] font-mono text-emerald-500 font-bold">{kpi.subtext}</p>
        </div>
      ))}
    </div>
  );
};
