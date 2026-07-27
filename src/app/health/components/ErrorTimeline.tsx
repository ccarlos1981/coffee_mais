"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { ErrorObservabilityItem } from "@/lib/governance/observability/metrics";

interface ErrorTimelineProps {
  errors: ErrorObservabilityItem[];
}

export const ErrorTimeline: React.FC<ErrorTimelineProps> = ({ errors }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Observabilidade & Histórico de Erros</h3>
            <p className="text-[11px] text-muted-foreground">Registro centralizado de exceções tratadas</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          0 Erros Não Tratados
        </span>
      </div>

      {errors.length === 0 ? (
        <div className="p-4 bg-background border border-border rounded-xl text-xs text-muted-foreground text-center">
          Nenhuma exceção ou erro registrado nas últimas 24h. Sistema 100% estável.
        </div>
      ) : (
        <div className="space-y-2 font-mono text-xs">
          {errors.map((err) => (
            <div key={err.id} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground font-sans block">{err.type} ({err.module})</span>
                <span className="text-[11px] text-muted-foreground font-sans block">{err.message}</span>
              </div>
              <span className="text-[10px] bg-muted px-2 py-1 rounded text-muted-foreground font-bold">{err.timestamp}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
