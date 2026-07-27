"use client";

import React from "react";
import { Zap } from "lucide-react";
import { SimulationRecommendation } from "@/lib/governance/analytics/simulation";

interface SimulationRecommendationCardProps {
  recomendacoes: SimulationRecommendation[];
  loading?: boolean;
}

export const SimulationRecommendationCard: React.FC<SimulationRecommendationCardProps> = ({
  recomendacoes,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Recomendações da Simulação</h3>
          <p className="text-[11px] text-muted-foreground">Classificação automática de prioridade e complexidade</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recomendacoes.map((rec) => (
          <div key={rec.id} className="bg-background border border-border rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                Prioridade: {rec.prioridade}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-500">
                +{rec.impactoPercentual}% ({formatCur(rec.impactoFinanceiroR$)})
              </span>
            </div>

            <h4 className="text-xs font-bold text-foreground">{rec.titulo}</h4>
            <p className="text-[11px] text-muted-foreground">{rec.descricao}</p>

            <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-muted-foreground font-mono">
              <span>Retorno: {rec.tempoRetornoMeses}m</span>
              <span>Complexidade: {rec.complexidade}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
