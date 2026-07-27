"use client";

import React from "react";
import { Tag } from "lucide-react";
import { ForecastDimensional } from "@/lib/governance/analytics/forecast";

interface ForecastCanalGridProps {
  canais: ForecastDimensional[];
  loading?: boolean;
}

export const ForecastCanalGrid: React.FC<ForecastCanalGridProps> = ({
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
          <h3 className="text-sm font-bold text-foreground">Forecast por Canal Comercial</h3>
          <p className="text-[11px] text-muted-foreground">Projeção por segmento de atendimento</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
            <tr>
              <th className="py-2.5 px-3 font-sans">Canal</th>
              <th className="py-2.5 px-3 text-right">Realizado</th>
              <th className="py-2.5 px-3 text-right">Projetado</th>
              <th className="py-2.5 px-3 text-right">Meta</th>
              <th className="py-2.5 px-3 text-center">Atingimento</th>
              <th className="py-2.5 px-3 text-right">MACO Proj.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {canais.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-sans font-bold text-foreground">{c.nome}</td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">{formatCur(c.realizado)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-500">{formatCur(c.projetado)}</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(c.meta)}</td>
                <td className="py-2.5 px-3 text-center font-bold text-foreground">{c.atingimentoPct}%</td>
                <td className="py-2.5 px-3 text-right text-foreground">{formatCur(c.macoProjetado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
