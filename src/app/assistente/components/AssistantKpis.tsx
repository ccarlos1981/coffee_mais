"use client";

import React from "react";

interface AssistantKpisProps {
  kpis?: { label: string; value: string; color?: string }[];
}

export const AssistantKpis: React.FC<AssistantKpisProps> = ({ kpis = [] }) => {
  if (kpis.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs mt-3">
      {kpis.map((kpi, idx) => (
        <div key={idx} className="bg-background/80 border border-border p-2.5 rounded-xl space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans font-semibold">
            {kpi.label}
          </span>
          <span
            className={`text-sm font-bold block ${
              kpi.color === "emerald"
                ? "text-emerald-500"
                : kpi.color === "rose"
                ? "text-rose-500"
                : kpi.color === "amber"
                ? "text-amber-500"
                : "text-foreground"
            }`}
          >
            {kpi.value}
          </span>
        </div>
      ))}
    </div>
  );
};
