"use client";

import React from "react";
import { Sparkles, DollarSign, ArrowRight, HelpCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { PrescriptionItem } from "@/lib/commercial-decision";

interface RecommendationsPanelProps {
  prescriptions: PrescriptionItem[];
}

export const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ prescriptions }) => {
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
            <h3 className="text-sm font-bold text-foreground">Recomendações Prescritivas de Próximas Ações</h3>
            <p className="text-[11px] text-muted-foreground">
              Sugestões priorizadas por impacto financeiro e probabilidade de conversão (Caráter Consultivo)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
          {prescriptions.length} Ações Prescritas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {prescriptions.map((pr) => (
          <div
            key={pr.id}
            className="p-4 bg-background border border-border rounded-xl space-y-3 flex flex-col justify-between hover:border-purple-500/40 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-muted text-purple-500 font-mono font-bold text-[9px] uppercase border border-border/40">
                  {pr.category}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                    pr.urgency === "IMMEDIATE"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }`}
                >
                  {pr.urgency}
                </span>
              </div>

              <h4 className="text-xs font-bold text-foreground">{pr.title}</h4>
              <p className="text-[11px] font-semibold text-gold">{pr.targetCustomer}</p>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/40 text-xs text-foreground space-y-1 font-mono">
                <span className="text-[10px] text-muted-foreground block font-sans">Ação Recomendada:</span>
                <span className="block font-semibold">{pr.actionText}</span>
              </div>

              <div className="p-2.5 bg-purple-500/5 rounded-lg border border-purple-500/20 text-[10px] text-muted-foreground font-mono space-y-1">
                <span className="text-purple-400 font-bold block flex items-center gap-1 font-sans">
                  <HelpCircle className="w-3 h-3" /> Explicabilidade do Modelo:
                </span>
                <span>{pr.explanation}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 flex items-center justify-between text-[11px] font-mono">
              <div>
                <span className="text-[9px] text-muted-foreground block">Impacto Estimado:</span>
                <span className="font-bold text-emerald-500">{formatCurrency(pr.expectedRevenueImpact)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-muted-foreground block">Confiança:</span>
                <span className="font-bold text-purple-500">{pr.confidenceScore}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
