"use client";

import React from "react";
import { Layers } from "lucide-react";
import { SimulationScenarioItem } from "@/lib/governance/analytics/simulation";

interface ScenarioComparisonProps {
  cenarios: SimulationScenarioItem[];
  loading?: boolean;
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({
  cenarios,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Comparativo de Cenários em Memória</h3>
          <p className="text-[11px] text-muted-foreground">Matriz de 5 cenários calculados simultaneamente</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th className="py-2.5 px-3 font-sans">Cenário</th>
              <th className="py-2.5 px-3 text-right">Faturamento</th>
              <th className="py-2.5 px-3 text-right">Variação (%)</th>
              <th className="py-2.5 px-3 text-right">MACO Proj.</th>
              <th className="py-2.5 px-3 text-center">Margem MACO</th>
              <th className="py-2.5 px-3 text-center">ROI (%)</th>
              <th className="py-2.5 px-3 text-center">Payback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cenarios.map((sc) => (
              <tr
                key={sc.id}
                className={`hover:bg-muted/30 transition-colors ${
                  sc.tipo === "PROVAVEL" ? "bg-gold/10 font-bold" : ""
                }`}
              >
                <td className="py-2.5 px-3 font-sans font-bold text-foreground">{sc.nome}</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(sc.faturamentoProjetado)}</td>
                <td className={`py-2.5 px-3 text-right ${sc.variacaoFaturamentoPct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {sc.variacaoFaturamentoPct >= 0 ? "+" : ""}{sc.variacaoFaturamentoPct}%
                </td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(sc.macoProjetado)}</td>
                <td className="py-2.5 px-3 text-center text-foreground">{sc.margemMacoPct}%</td>
                <td className="py-2.5 px-3 text-center text-emerald-500">{sc.roiPct}%</td>
                <td className="py-2.5 px-3 text-center text-foreground">{sc.paybackMeses > 0 ? `${sc.paybackMeses}m` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
