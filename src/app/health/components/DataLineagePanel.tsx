"use client";

import React from "react";
import { GitCommit, ArrowRight, ShieldCheck, Layers, Server, Activity } from "lucide-react";
import { EnterpriseDataLineageData } from "@/lib/governance/data-quality";

interface DataLineagePanelProps {
  lineageData: EnterpriseDataLineageData;
}

export const DataLineagePanel: React.FC<DataLineagePanelProps> = ({ lineageData }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <GitCommit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Data Lineage & Rastreabilidade de Origem (Frente 10)</h3>
            <p className="text-[11px] text-muted-foreground">
              Mapeamento completo: Origem → Transformação → Engine Consumidora → API → Dashboard
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-gold/10 text-gold border border-gold/20">
          {lineageData.overview.totalLineageNodes} Fluxos Auditados (100% Rastreáveis)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Domínio</th>
              <th className="py-2.5 px-3">Origem (Source)</th>
              <th className="py-2.5 px-3">Transformação / View</th>
              <th className="py-2.5 px-3">Engine Consumidora</th>
              <th className="py-2.5 px-3">API HTTP</th>
              <th className="py-2.5 px-3">Dashboard Consumidor</th>
              <th className="py-2.5 px-3 text-right">Status do Fluxo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {lineageData.lineage.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-3 px-3 font-bold text-foreground font-sans">
                  {item.domain}
                </td>
                <td className="py-3 px-3 text-muted-foreground font-sans">
                  {item.source}
                </td>
                <td className="py-3 px-3 text-teal-400 font-sans">
                  {item.transformation}
                </td>
                <td className="py-3 px-3 text-gold font-bold">
                  {item.consumingEngine}
                </td>
                <td className="py-3 px-3 text-blue-400">
                  {item.apiEndpoint}
                </td>
                <td className="py-3 px-3 text-foreground font-sans">
                  {item.dashboardModule}
                </td>
                <td className="py-3 px-3 text-right font-sans">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    {item.dataFlowStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
