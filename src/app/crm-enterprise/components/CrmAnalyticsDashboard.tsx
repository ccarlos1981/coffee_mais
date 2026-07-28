"use client";

import React from "react";
import { BarChart3, Trophy, TrendingUp, Users } from "lucide-react";
import { CrmEnterpriseData } from "@/lib/crm-enterprise";

interface CrmAnalyticsDashboardProps {
  data: CrmEnterpriseData;
}

export const CrmAnalyticsDashboard: React.FC<CrmAnalyticsDashboardProps> = ({ data }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ranking Comercial por Gerente */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="p-2 rounded-xl bg-gold/10 text-gold">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ranking Comercial por Gerente de Conta</h3>
              <p className="text-[11px] text-muted-foreground">
                Valor total acumulado em funil e taxa de conversão histórica
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-2 px-3">Gerente</th>
                  <th className="py-2 px-3">Oportunidades</th>
                  <th className="py-2 px-3">Valor Total</th>
                  <th className="py-2 px-3 text-right">Taxa Conversão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
                {data.managerRanking.map((m, idx) => (
                  <tr key={m.manager} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-foreground font-sans flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gold/10 text-gold flex items-center justify-center font-mono font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      {m.manager}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {m.oppsCount} opps
                    </td>
                    <td className="py-2.5 px-3 font-bold text-gold">
                      {formatCurrency(m.totalValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-500 font-sans">
                      {m.conversionPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumo do Funil por Estágio */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="p-2 rounded-xl bg-gold/10 text-gold">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Distribuição do Funil por Estágio</h3>
              <p className="text-[11px] text-muted-foreground">
                Consolidação financeira estimada por fase do ciclo de vendas
              </p>
            </div>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {Object.entries(data.pipelineByStage).map(([stageKey, info]) => {
              const label = data.stageLabels[stageKey as keyof typeof data.stageLabels] || stageKey;
              return (
                <div key={stageKey} className="p-2.5 bg-background border border-border rounded-xl flex items-center justify-between">
                  <span className="font-bold font-sans text-foreground">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{info.count} opps</span>
                    <span className="font-bold text-gold">{formatCurrency(info.totalValue)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
