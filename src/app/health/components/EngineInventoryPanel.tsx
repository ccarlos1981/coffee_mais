"use client";

import React from "react";
import { Box, Lock, CheckCircle2 } from "lucide-react";
import { EngineInventoryItem } from "@/lib/governance/architecture";

interface EngineInventoryPanelProps {
  engines: EngineInventoryItem[];
}

export const EngineInventoryPanel: React.FC<EngineInventoryPanelProps> = ({ engines }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Inventário de Engines da Plataforma (14 Motores)</h3>
            <p className="text-[11px] text-muted-foreground">
              Mapeamento de motores analíticos, preditivos, de simulação e de governança técnica
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
          {engines.length} Motores Congelados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Engine / Motor</th>
              <th className="py-2.5 px-3">Categoria</th>
              <th className="py-2.5 px-3">Arquivo / Path</th>
              <th className="py-2.5 px-3">Fonte Oficial</th>
              <th className="py-2.5 px-3 text-right">Modo / Isolamento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {engines.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <Box className="w-3.5 h-3.5 text-teal-500" />
                  {item.name}
                </td>
                <td className="py-2.5 px-3 font-sans">
                  <span className="px-2 py-0.5 rounded bg-muted text-teal-500 font-bold border border-border/50 text-[10px]">
                    {item.category}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {item.fileLocation}
                </td>
                <td className="py-2.5 px-3 text-foreground font-sans">
                  {item.officialSource}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500 font-sans">
                  READ-ONLY ({item.isolationLevel})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
