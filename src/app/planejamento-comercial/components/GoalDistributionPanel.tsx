"use client";

import React from "react";
import { Target, TrendingUp, DollarSign } from "lucide-react";
import { GoalDistributionItem } from "@/lib/commercial-planning";

interface GoalDistributionPanelProps {
  goalDistributions: GoalDistributionItem[];
}

export const GoalDistributionPanel: React.FC<GoalDistributionPanelProps> = ({ goalDistributions }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Desdobramento & Rateio de Metas Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de metas anuais e trimestrais por Gerente de Conta com análise de gap
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          {goalDistributions.length} Gerentes Alocados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Gerente / Regional</th>
              <th className="py-2.5 px-3">Meta Anual</th>
              <th className="py-2.5 px-3">Realizado YTD</th>
              <th className="py-2.5 px-3 text-center">Atingimento %</th>
              <th className="py-2.5 px-3">Meta Q3</th>
              <th className="py-2.5 px-3">Projeção Q3</th>
              <th className="py-2.5 px-3 text-right">Superavit / Gap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {goalDistributions.map((g, idx) => (
              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  <span className="block font-bold">{g.accountManager}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{g.regional}</span>
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {formatCurrency(g.annualGoalAmount)}
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-medium">
                  {formatCurrency(g.realizedYtdAmount)}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-indigo-500">
                  {g.targetAchievementPct}%
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {formatCurrency(g.q3GoalAmount)}
                </td>
                <td className="py-2.5 px-3 font-bold text-emerald-500">
                  {formatCurrency(g.q3ProjectedAmount)}
                </td>
                <td className="py-2.5 px-3 text-right font-sans font-bold text-emerald-500">
                  +{formatCurrency(Math.abs(g.gapAmount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
