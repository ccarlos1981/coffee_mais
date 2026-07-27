"use client";

import React from "react";
import { Package } from "lucide-react";
import { SimulationDimensional } from "@/lib/governance/analytics/simulation";

interface SimulationSkuGridProps {
  skus: SimulationDimensional[];
  loading?: boolean;
}

export const SimulationSkuGrid: React.FC<SimulationSkuGridProps> = ({
  skus,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Package className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Impacto Simulado por SKU / Categoria</h3>
          <p className="text-[11px] text-muted-foreground">Desempenho projetado por produto principal</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th className="py-2.5 px-3 font-sans">SKU / Produto</th>
              <th className="py-2.5 px-3 text-right">Base Atual</th>
              <th className="py-2.5 px-3 text-right">Simulado</th>
              <th className="py-2.5 px-3 text-right">Diferença</th>
              <th className="py-2.5 px-3 text-center">Variação (%)</th>
              <th className="py-2.5 px-3 text-right">MACO Simulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {skus.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-foreground truncate max-w-[200px]">{s.nome}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCur(s.base)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCur(s.simulado)}</td>
                <td className="py-2.5 px-3 text-right text-gold">+{formatCur(s.diferenca)}</td>
                <td className="py-2.5 px-3 text-center font-bold text-emerald-500">+{s.variacaoPct}%</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(s.macoSimulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
