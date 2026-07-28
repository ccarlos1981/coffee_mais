"use client";

import React from "react";
import { Zap, CheckCircle2, Star } from "lucide-react";
import { FeatureUsageItem } from "@/lib/governance/telemetry";

interface FeatureUsagePanelProps {
  featureUsage: FeatureUsageItem[];
}

export const FeatureUsagePanel: React.FC<FeatureUsagePanelProps> = ({ featureUsage }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Inventário & Utilização de Funcionalidades (Frente 4)</h3>
          <p className="text-[11px] text-muted-foreground">
            Monitoramento de recursos mais utilizados vs funcionalidades subutilizadas
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Funcionalidade / Recurso</th>
              <th className="py-2.5 px-3">Módulo</th>
              <th className="py-2.5 px-3">Frequência</th>
              <th className="py-2.5 px-3">Execuções Mensais</th>
              <th className="py-2.5 px-3 text-right">Taxa de Adoção (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {featureUsage.map((item) => (
              <tr key={item.featureName} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  {item.featureName}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans">
                  {item.module}
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded bg-muted text-amber-500 font-bold border border-border/50 text-[10px]">
                    {item.usageFrequency}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {item.monthlyExecutions.toLocaleString("pt-BR")}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500 font-sans">
                  {item.adoptionPct}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
