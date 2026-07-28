"use client";

import React from "react";
import { Award, Layers, Activity } from "lucide-react";
import { AdoptionScoreBreakdown } from "@/lib/governance/telemetry";

interface AdoptionScoreCardProps {
  breakdown: AdoptionScoreBreakdown;
}

export const AdoptionScoreCard: React.FC<AdoptionScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Adoption Score por Componente Negocial</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação oficial de adoção (30% Módulos | 20% Funcionalidades | 20% Frequência | 15% Jornada | 10% Retenção | 5% Governança)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          Global: {breakdown.globalAdoptionScore}/100
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs text-center">
        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Módulos (30%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.moduleUsageScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Recursos (20%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.featureUsageScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Frequência (20%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.accessFrequencyScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Jornada (15%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.userJourneyScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Retenção (10%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.retentionScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-amber-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>
    </div>
  );
};
