"use client";

import React from "react";
import { ShieldCheck, CheckCircle2, FileCheck } from "lucide-react";
import { ReleaseReadinessCheck } from "@/lib/governance/devex";

interface ReleaseReadinessPanelProps {
  releaseReadiness: ReleaseReadinessCheck[];
}

export const ReleaseReadinessPanel: React.FC<ReleaseReadinessPanelProps> = ({ releaseReadiness }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Release Readiness Checklist (Certificação Técnica)</h3>
            <p className="text-[11px] text-muted-foreground">
              Validações objetivas exigidas para homologação de releases produtivas
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          RELEASE READINESS = PASSED
        </span>
      </div>

      <div className="space-y-2">
        {releaseReadiness.map((chk) => (
          <div key={chk.id} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-foreground font-sans block">{chk.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">Fonte: {chk.verifiedSource}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span className="text-[10px] text-muted-foreground uppercase">{chk.category}</span>
              <span className="text-xs font-bold text-emerald-500 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-sans">
                {chk.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
