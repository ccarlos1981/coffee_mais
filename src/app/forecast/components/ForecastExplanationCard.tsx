"use client";

import React from "react";
import { FileText, Lightbulb, AlertCircle } from "lucide-react";
import { ForecastExplanation } from "@/lib/governance/analytics/forecast";

interface ForecastExplanationCardProps {
  explicacao: ForecastExplanation;
  loading?: boolean;
}

export const ForecastExplanationCard: React.FC<ForecastExplanationCardProps> = ({
  explicacao,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Explicação Executiva Automática do Forecast</h3>
          <p className="text-[11px] text-muted-foreground">Detalhamento dos fatores que conduziram à projeção calculada</p>
        </div>
      </div>

      <div className="bg-background border border-border rounded-xl p-4 space-y-3">
        <p className="text-xs text-foreground font-medium leading-relaxed">
          {explicacao.resumoExecutivo}
        </p>

        <div className="space-y-2 pt-2 border-t border-border">
          <span className="text-[10px] font-bold uppercase text-gold flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5" />
            Drivers Principais do Resultado
          </span>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {explicacao.driversPrincipais.map((d, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
