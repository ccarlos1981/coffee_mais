"use client";

import React from "react";
import { Award, Code, CheckCircle2 } from "lucide-react";
import { DevExScoreBreakdown } from "@/lib/governance/devex";

interface DevExScoreCardProps {
  breakdown: DevExScoreBreakdown;
}

export const DevExScoreCard: React.FC<DevExScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">DevEx Score por Componente Técnico</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação de engenharia (30% Pipelines | 20% Tempo Build/Deploy | 20% Estabilidade | 15% Workflows | 10% Release Readiness | 5% Gov)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
          Global: {breakdown.globalDevExScore}/100
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs text-center">
        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Pipelines (30%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.pipelineSuccessScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Build/Deploy (20%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.buildDeployTimeScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Estabilidade (20%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.releaseStabilityScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Workflows (15%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.workflowCoverageScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Readiness (10%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.releaseReadinessScore}%</span>
        </div>

        <div className="p-2.5 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-cyan-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>
    </div>
  );
};
