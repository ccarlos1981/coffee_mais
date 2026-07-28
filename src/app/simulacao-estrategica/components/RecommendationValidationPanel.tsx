"use client";

import React from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { RecommendationValidationItem } from "@/lib/commercial-scenarios";

interface RecommendationValidationPanelProps {
  validations: RecommendationValidationItem[];
}

export const RecommendationValidationPanel: React.FC<RecommendationValidationPanelProps> = ({
  validations,
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Validador de Hipóteses do Assistente de Decisão</h3>
            <p className="text-[11px] text-muted-foreground">
              Simulação do retorno financeiro real das recomendações geradas pelo motor decisório
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
          {validations.length} Hipóteses Testadas
        </span>
      </div>

      <div className="space-y-3">
        {validations.map((v) => (
          <div
            key={v.prescriptionId}
            className="p-4 bg-background border border-border rounded-xl space-y-2 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block font-sans">{v.targetCustomer}</span>
                <h4 className="text-xs font-bold text-foreground font-sans">{v.prescriptionTitle}</h4>
              </div>

              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl border ${
                  v.validationStatus === "VALIDATED"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }`}
              >
                {v.validationStatus} (Variância: {v.variancePct > 0 ? "+" : ""}{v.variancePct}%)

              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-muted-foreground">Impacto Estimado: <strong className="text-foreground">{formatCurrency(v.originalImpactEstimate)}</strong></span>
              <span className="text-muted-foreground">Resultado Simulado: <strong className="text-emerald-500">{formatCurrency(v.simulatedImpactResult)}</strong></span>
            </div>

            <div className="p-2.5 bg-muted/40 rounded-lg border border-border/40 text-[11px] text-muted-foreground font-mono">
              <span className="text-foreground font-bold font-sans block">Diagnóstico de Validação:</span>
              <span>{v.insights}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
