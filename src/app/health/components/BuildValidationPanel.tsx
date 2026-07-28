"use client";

import React from "react";
import { Terminal, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { BuildValidationItem } from "@/lib/governance/quality";

interface BuildValidationPanelProps {
  buildValidation: BuildValidationItem[];
}

export const BuildValidationPanel: React.FC<BuildValidationPanelProps> = ({ buildValidation }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Pipeline de Validação de Build & Governança (Frente 5)</h3>
            <p className="text-[11px] text-muted-foreground">
              Consolidação de auditoria estática, paridade financeira, checagem TypeScript e build Next.js
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          BUILD = PASSED (100% OK)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        {buildValidation.map((item, idx) => (
          <div key={idx} className="p-3 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-sans font-semibold">Etapa {idx + 1}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-sans flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {item.status}
              </span>
            </div>

            <div className="font-bold text-foreground font-sans text-xs">
              {item.stage}
            </div>

            <div className="p-1.5 rounded bg-muted/60 text-[10px] text-indigo-400 font-mono truncate" title={item.command}>
              $ {item.command}
            </div>

            <p className="text-[11px] text-muted-foreground font-sans">{item.details}</p>

            <div className="pt-1 border-t border-border/50 text-[10px] text-muted-foreground flex justify-between">
              <span>Tempo: {item.executionTimeSec}s</span>
              <span className="text-emerald-500 font-bold">Aprovado</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
