"use client";

import React from "react";
import { Layers } from "lucide-react";
import { ForecastScenario } from "@/lib/governance/analytics/forecast";

interface ForecastScenarioCardProps {
  cenarios: ForecastScenario;
  loading?: boolean;
}

export const ForecastScenarioCard: React.FC<ForecastScenarioCardProps> = ({
  cenarios,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Cenários de Projeção em Memória</h3>
            <p className="text-[11px] text-muted-foreground">Simulação estocástica sem gravação no banco de dados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-background border border-gold/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-gold font-bold uppercase">Cenário Base (Oficial)</span>
          <div className="text-base font-bold text-foreground">{formatCur(cenarios.cenarioBase)}</div>
        </div>

        <div className="bg-background border border-emerald-500/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-emerald-500 font-bold uppercase">Cenário Otimista (+7%)</span>
          <div className="text-base font-bold text-emerald-500">{formatCur(cenarios.cenarioOtimista)}</div>
        </div>

        <div className="bg-background border border-amber-500/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-amber-500 font-bold uppercase">Cenário Conservador (-6%)</span>
          <div className="text-base font-bold text-amber-500">{formatCur(cenarios.cenarioConservador)}</div>
        </div>

        <div className="bg-background border border-rose-500/30 rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-rose-500 font-bold uppercase">Cenário Pessimista (-12%)</span>
          <div className="text-base font-bold text-rose-500">{formatCur(cenarios.cenarioPessimista)}</div>
        </div>
      </div>
    </div>
  );
};
