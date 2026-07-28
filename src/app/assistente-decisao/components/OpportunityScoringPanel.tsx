"use client";

import React from "react";
import { Target, Award, DollarSign } from "lucide-react";
import { OpportunityScoreItem } from "@/lib/commercial-decision";

interface OpportunityScoringPanelProps {
  scores: OpportunityScoreItem[];
}

export const OpportunityScoringPanel: React.FC<OpportunityScoringPanelProps> = ({ scores }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Scoring Comercial de Oportunidades (Algoritmo 0-100)</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação ponderada por Impacto Financeiro (40%), Probabilidade (30%), Urgência (20%) e Relevância (10%)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
          {scores.length} Oportunidades Avaliadas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Oportunidade / Cliente</th>
              <th className="py-2.5 px-3">Gerente</th>
              <th className="py-2.5 px-3">Valor Estimado</th>
              <th className="py-2.5 px-3 text-center">Impacto (40%)</th>
              <th className="py-2.5 px-3 text-center">Probab. (30%)</th>
              <th className="py-2.5 px-3 text-center">Urgência (20%)</th>
              <th className="py-2.5 px-3 text-right">Score Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {scores.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  <div>
                    <span className="block font-bold">{s.opportunityTitle}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{s.customerName}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans font-medium">
                  {s.accountManager}
                </td>
                <td className="py-2.5 px-3 font-bold text-gold">
                  {formatCurrency(s.estimatedValue)}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">
                  {s.financialImpactScore}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">
                  {s.probabilityScore}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">
                  {s.urgencyScore}
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span
                    className={`inline-block px-2.5 py-1 rounded font-bold text-xs border ${
                      s.totalCommercialScore >= 85
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-purple-500/10 text-purple-500 border-purple-500/20"
                    }`}
                  >
                    {s.totalCommercialScore.toFixed(1)} / 100
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
