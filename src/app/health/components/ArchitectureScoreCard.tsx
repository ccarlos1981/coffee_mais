"use client";

import React from "react";
import { Award, Layers, CheckCircle2 } from "lucide-react";
import { ArchitectureScoreBreakdown } from "@/lib/governance/architecture";

interface ArchitectureScoreCardProps {
  breakdown: ArchitectureScoreBreakdown;
}

export const ArchitectureScoreCard: React.FC<ArchitectureScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Architecture Score por Dimensão de Governança</h3>
            <p className="text-[11px] text-muted-foreground">
              Maturidade técnica (30% Padronização | 20% Documentação | 20% Dependências | 15% Rastreabilidade | 10% Desacoplamento | 5% Gov)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
          Global: {breakdown.globalArchitectureScore}/100
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs text-center">
        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Padronização (30%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.patternStandardizationScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Documentação (20%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.documentationCoverageScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Dependências (20%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.dependencyMappingScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Rastreabilidade (15%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.technicalTraceabilityScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Desacoplamento (10%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.layerDecouplingScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>
    </div>
  );
};
