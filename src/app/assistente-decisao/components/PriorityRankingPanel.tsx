"use client";

import React from "react";
import { Trophy, Award, ArrowRight } from "lucide-react";
import { PrioritizationItem } from "@/lib/commercial-decision";

interface PriorityRankingPanelProps {
  priorities: PrioritizationItem[];
}

export const PriorityRankingPanel: React.FC<PriorityRankingPanelProps> = ({ priorities }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Ranking Unificado de Prioridades Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Fila única de priorização executiva ordenada por Score Comercial Composto
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
          {priorities.length} Oportunidades Ranqueadas
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Rank / Oportunidade</th>
              <th className="py-2.5 px-3">Cliente</th>
              <th className="py-2.5 px-3">Gerente</th>
              <th className="py-2.5 px-3">Valor Potencial</th>
              <th className="py-2.5 px-3 text-center">Score Composto</th>
              <th className="py-2.5 px-3 text-right">Ação Necessária</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {priorities.map((p) => (
              <tr key={p.rank} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center font-mono font-bold text-xs">
                    #{p.rank}
                  </span>
                  <span>{p.opportunityTitle}</span>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans font-medium">
                  {p.customerName}
                </td>
                <td className="py-2.5 px-3 text-foreground font-sans">
                  {p.accountManager}
                </td>
                <td className="py-2.5 px-3 font-bold text-gold">
                  {formatCurrency(p.potentialValue)}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-purple-500">
                  {p.compositeScore.toFixed(1)} / 100
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground font-bold text-[10px] border border-border/40">
                    {p.actionRequired}
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
