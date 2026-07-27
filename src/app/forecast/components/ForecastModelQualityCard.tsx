"use client";

import React from "react";
import { Cpu } from "lucide-react";
import { ForecastModelQuality } from "@/lib/governance/analytics/forecast";

interface ForecastModelQualityCardProps {
  qualidadeModelo: ForecastModelQuality;
  loading?: boolean;
}

export const ForecastModelQualityCard: React.FC<ForecastModelQualityCardProps> = ({
  qualidadeModelo,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Indicadores Técnicos de Qualidade do Modelo</h3>
          <p className="text-[11px] text-muted-foreground">Métricas estocásticas de precisão e erro médio histórico</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Precisão Histórica</span>
          <div className="text-lg font-bold text-emerald-500">{qualidadeModelo.precisaoHistoricaPct}%</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Erro Médio (MAPE)</span>
          <div className="text-lg font-bold text-foreground">{qualidadeModelo.erroMedioPct}%</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Maior Erro Histórico</span>
          <div className="text-lg font-bold text-amber-500">{qualidadeModelo.maiorErroHistoricoPct}%</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Confiabilidade Global</span>
          <div className="text-lg font-bold text-gold">{qualidadeModelo.confiabilidadeModeloPct}%</div>
        </div>
      </div>
    </div>
  );
};
