"use client";

import React from "react";
import { DollarSign, Building2, Layers } from "lucide-react";
import { CommercialPlanItem } from "@/lib/commercial-planning";

interface CommercialPlanPanelProps {
  plans: CommercialPlanItem[];
}

export const CommercialPlanPanel: React.FC<CommercialPlanPanelProps> = ({ plans }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Plano Comercial Oficial Consolidado</h3>
            <p className="text-[11px] text-muted-foreground">
              Detalhamento dos objetivos por Gerente de Conta, Canal de Atendimento e Regional
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          {plans.length} Planos Alinhados
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <thead>
            <tr className="border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <th className="py-2.5 px-3">Gerente / Canal</th>
              <th className="py-2.5 px-3">Regional</th>
              <th className="py-2.5 px-3">Volume (kg)</th>
              <th className="py-2.5 px-3">Fat. Planejado</th>
              <th className="py-2.5 px-3">Verba Trade</th>
              <th className="py-2.5 px-3 text-center">Margem MACO</th>
              <th className="py-2.5 px-3 text-right">Status do Plano</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50 text-foreground font-mono text-[11px]">
            {plans.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-bold text-foreground font-sans">
                  <div>
                    <span className="block font-bold">{p.accountManager}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{p.channel}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground font-sans font-medium">
                  {p.regional}
                </td>
                <td className="py-2.5 px-3 font-bold text-foreground">
                  {p.plannedVolumeKg.toLocaleString("pt-BR")} kg
                </td>
                <td className="py-2.5 px-3 font-bold text-indigo-500">
                  {formatCurrency(p.plannedRevenue)}
                </td>
                <td className="py-2.5 px-3 font-bold text-gold">
                  {formatCurrency(p.plannedTradeInvestment)}
                </td>
                <td className="py-2.5 px-3 text-center font-bold text-emerald-500">
                  {p.netMarginPct}%
                </td>
                <td className="py-2.5 px-3 text-right font-sans">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px] border border-emerald-500/20">
                    {p.status}
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
