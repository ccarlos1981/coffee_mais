"use client";

import React from "react";
import { UserCheck } from "lucide-react";
import { ForecastDimensional } from "@/lib/governance/analytics/forecast";

interface ForecastGerenteGridProps {
  gerentes: ForecastDimensional[];
  loading?: boolean;
}

export const ForecastGerenteGrid: React.FC<ForecastGerenteGridProps> = ({
  gerentes,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <UserCheck className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Forecast por Gerente Comercial</h3>
          <p className="text-[11px] text-muted-foreground">Desempenho projetado por responsável da carteira</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th className="py-2.5 px-3 font-sans">Gerente Comercial</th>
              <th className="py-2.5 px-3 text-right">Realizado</th>
              <th className="py-2.5 px-3 text-right">Projetado</th>
              <th className="py-2.5 px-3 text-right">Meta</th>
              <th className="py-2.5 px-3 text-center">Atingimento</th>
              <th className="py-2.5 px-3 text-center">Margem MACO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {gerentes.map((g) => (
              <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-foreground">{g.nome}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCur(g.realizado)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCur(g.projetado)}</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(g.meta)}</td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">{g.atingimentoPct}%</td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">{g.margemMacoPct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
