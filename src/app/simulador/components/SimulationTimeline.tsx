"use client";

import React from "react";
import { CalendarRange } from "lucide-react";

interface SimulationTimelineProps {
  timeline: {
    mes: string;
    faturamentoBase: number;
    faturamentoSimulado: number;
  }[];
  loading?: boolean;
}

export const SimulationTimeline: React.FC<SimulationTimelineProps> = ({
  timeline,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <CalendarRange className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Timeline de Evolução (6 Meses)</h3>
          <p className="text-[11px] text-muted-foreground">Projeção da curva de aceleração acumulada em memória</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        {timeline.map((item) => (
          <div key={item.mes} className="bg-background border border-border rounded-xl p-3 space-y-1">
            <span className="text-[10px] text-gold font-bold uppercase">{item.mes}</span>
            <div className="text-[11px] text-muted-foreground">Base: {formatCur(item.faturamentoBase)}</div>
            <div className="text-xs font-bold text-emerald-500">Sim: {formatCur(item.faturamentoSimulado)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
