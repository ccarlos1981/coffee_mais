"use client";

import React from "react";
import { Clock, RefreshCw, CheckCircle2 } from "lucide-react";
import { FreshnessAuditItem } from "@/lib/governance/data-quality";

interface FreshnessPanelProps {
  freshness: FreshnessAuditItem[];
}

export const FreshnessPanel: React.FC<FreshnessPanelProps> = ({ freshness }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Tempestividade & Idade dos Dados (Data Freshness)</h3>
          <p className="text-[11px] text-muted-foreground">
            Monitoramento de última sincronização e atraso de cargas analíticas (Frente 8)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {freshness.map((item, idx) => (
          <div key={idx} className="p-3 bg-background border border-border rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-sans uppercase">Fonte de Dados</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-sans">
                {item.loadStatus}
              </span>
            </div>

            <div className="font-bold text-foreground font-sans truncate text-xs" title={item.sourceName}>
              {item.sourceName}
            </div>

            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/50 text-muted-foreground">
              <span>Idade: <strong className="text-emerald-500">{item.ageMinutes} min</strong></span>
              <span>Freq. Esperada: {item.expectedFrequencyMin} min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
