"use client";

import React from "react";
import { Award, Layers, Cpu } from "lucide-react";
import { QualityScoreBreakdown } from "@/lib/governance/quality";

interface QualityScoreCardProps {
  breakdown: QualityScoreBreakdown;
}

export const QualityScoreCard: React.FC<QualityScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Quality Score por Módulo & Componente</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação ponderada oficial (25% Unitários | 20% Integração | 15% APIs | 15% Engines | 10% Cobertura | 10% Build | 5% Governança)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
          Global: {breakdown.globalQualityScore}/100
        </span>
      </div>

      {/* Breakdown dos Componentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-xs text-center">
        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Unitários (25%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.unitTestsScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Integração (20%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.integrationTestsScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">APIs (15%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.apiTestsScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Engines (15%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.engineTestsScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Cobertura (10%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.coverageScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Build (10%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.buildScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-indigo-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>

      {/* Grid de Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdown.moduleScores.map((mod) => (
          <div key={mod.module} className="p-3 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-bold text-foreground">{mod.module}</span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-500">
                {mod.score}/100
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{ width: `${mod.score}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
              <span>Testes: {mod.testCount}</span>
              <span>Cobertura: <strong className="text-indigo-500">{mod.coveragePct}%</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
