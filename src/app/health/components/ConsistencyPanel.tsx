"use client";

import React from "react";
import { GitCompare, CheckCircle2, ShieldCheck } from "lucide-react";
import { ConsistencyAuditItem } from "@/lib/governance/data-quality";

interface ConsistencyPanelProps {
  consistency: ConsistencyAuditItem[];
}

export const ConsistencyPanel: React.FC<ConsistencyPanelProps> = ({ consistency }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
          <GitCompare className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Auditoria de Consistência & Padrões Cadastrais</h3>
          <p className="text-[11px] text-muted-foreground">
            Detecção de duplicidades, cadastros conflitantes e quebras de padrão (Frente 6)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {consistency.map((item, idx) => (
          <div key={idx} className="p-3.5 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground font-sans">{item.checkName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                {item.status}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">{item.description}</p>

            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/50">
              <span>Duplicidades: <strong className="text-emerald-500">{item.duplicateCount}</strong></span>
              <span>Conflitos: <strong className="text-emerald-500">{item.conflictCount}</strong></span>
              <span>Padrões Inválidos: <strong className="text-emerald-500">{item.invalidPatternCount}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
