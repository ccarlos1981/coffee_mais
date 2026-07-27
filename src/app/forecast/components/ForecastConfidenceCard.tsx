"use client";

import React from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { ForecastConfidence } from "@/lib/governance/analytics/forecast";

interface ForecastConfidenceCardProps {
  confianca: ForecastConfidence;
  loading?: boolean;
}

export const ForecastConfidenceCard: React.FC<ForecastConfidenceCardProps> = ({
  confianca,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Grau de Confiança do Forecast</h3>
            <p className="text-[11px] text-muted-foreground">Índice estocástico calculado pelo motor preditivo</p>
          </div>
        </div>

        <span className="text-lg font-black font-mono text-emerald-500 bg-emerald-500/10 px-3 py-0.5 rounded-full border border-emerald-500/20">
          {confianca.indiceConfiancaPct}% Confiança ({confianca.nivel})
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-2">
          <span className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fatores que Aumentam a Confiança
          </span>
          <ul className="space-y-1 text-muted-foreground">
            {confianca.fatoresPositivos.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-2">
          <span className="text-[10px] font-bold uppercase text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Fatores que Reduzem a Confiança
          </span>
          <ul className="space-y-1 text-muted-foreground">
            {confianca.fatoresNegativos.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
