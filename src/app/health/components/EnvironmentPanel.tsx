"use client";

import React from "react";
import { Server, EyeOff, CheckCircle2, Shield, Lock } from "lucide-react";
import { EnvironmentAuditItem } from "@/lib/governance/security";

interface EnvironmentPanelProps {
  environmentAudit: EnvironmentAuditItem[];
}

export const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({ environmentAudit }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Status de Variáveis de Ambiente & Configuração</h3>
            <p className="text-[11px] text-muted-foreground">
              Auditoria de integridade sem exibição de valores (100% Ocultos / Mascarados)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
          <EyeOff className="w-3.5 h-3.5" />
          <span>ZERO SECRETS EXPOSED</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
        {environmentAudit.map((item) => (
          <div key={item.key} className="p-3 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-sans uppercase">{item.category}</span>
              {item.isSecret && (
                <span className="text-[10px] text-amber-500 flex items-center gap-0.5 font-sans">
                  <Lock className="w-3 h-3" /> Secret
                </span>
              )}
            </div>

            <div className="font-bold text-foreground truncate text-[11px]" title={item.key}>
              {item.key}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              <span className="text-[10px] text-muted-foreground font-sans">{item.environment}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  item.status === "VALIDATED" || item.status === "CONFIGURED"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : item.status === "MASKED"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                }`}
              >
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
