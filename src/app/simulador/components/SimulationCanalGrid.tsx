"use client";

import React from "react";
import { Tag } from "lucide-react";
import { SimulationDimensional } from "@/lib/governance/analytics/simulation";

interface SimulationCanalGridProps {
  canais: SimulationDimensional[];
  loading?: boolean;
}

export const SimulationCanalGrid: React.FC<SimulationCanalGridProps> = ({
  canais,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Impacto Simulado por Canal</h3>
          <p className="text-[11px] text-muted-foreground">Efeito da decisão nos canais de atendimento</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th className="py-2.5 px-3 font-sans">Canal</th>
              <th className="py-2.5 px-3 text-right">Base Atual</th>
              <th className="py-2.5 px-3 text-right">Simulado</th>
              <th className="py-2.5 px-3 text-right">Diferença</th>
              <th className="py-2.5 px-3 text-center">Variação (%)</th>
              <th className="py-2.5 px-3 text-right">MACO Simulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {canais.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-foreground">{c.nome}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCur(c.base)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCur(c.simulado)}</td>
                <td className="py-2.5 px-3 text-right text-gold">+{formatCur(c.diferenca)}</td>
                <td className="py-2.5 px-3 text-center font-bold text-emerald-500">+{c.variacaoPct}%</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(c.macoSimulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
