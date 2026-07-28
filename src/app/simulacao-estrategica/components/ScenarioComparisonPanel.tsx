"use client";

import React from "react";
import { Layers, ArrowRight } from "lucide-react";

interface ScenarioComparisonPanelProps {
  comparisonTable: {
    metricName: string;
    baseValue: string;
    optimisticValue: string;
    conservativeValue: string;
    customValue: string;
  }[];
}

export const ScenarioComparisonPanel: React.FC<ScenarioComparisonPanelProps> = ({ comparisonTable }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Matriz Comparativa de Cenários Lado a Lado</h3>
            <p className="text-[11px] text-muted-foreground">
              Comparação direta entre o fechamento oficial e os cenários simulados
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Métrica de Negócio</th>
              <th className="py-2.5 px-3">Cenário Base (Oficial)</th>
              <th className="py-2.5 px-3 text-emerald-500 font-bold">Cenário Otimista (+15%)</th>
              <th className="py-2.5 px-3 text-rose-500 font-bold">Cenário Conservador (-10%)</th>
              <th className="py-2.5 px-3 text-gold font-bold">Cenário Customizado (SP/RS)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {comparisonTable.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-bold text-foreground font-sans">
                  {row.metricName}
                </td>
                <td className="py-3 px-3 font-bold text-foreground">
                  {row.baseValue}
                </td>
                <td className="py-3 px-3 font-bold text-emerald-500 bg-emerald-500/5">
                  {row.optimisticValue}
                </td>
                <td className="py-3 px-3 font-bold text-rose-500 bg-rose-500/5">
                  {row.conservativeValue}
                </td>
                <td className="py-3 px-3 font-bold text-gold bg-gold/5">
                  {row.customValue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
