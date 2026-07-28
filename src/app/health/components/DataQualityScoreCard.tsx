"use client";

import React from "react";
import { Award, Database, Layers } from "lucide-react";
import { QualityScoreBreakdown } from "@/lib/governance/data-quality";

interface DataQualityScoreCardProps {
  breakdown: QualityScoreBreakdown;
}

export const DataQualityScoreCard: React.FC<DataQualityScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-500">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Data Quality Score por Domínio & Componente</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação oficial (25% Completude | 20% Consistência | 15% Integridade | 15% Atualização | 10% Unicidade | 10% Validação | 5% Governança)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
          Global: {breakdown.globalQualityScore}/100
        </span>
      </div>

      {/* Breakdown dos Componentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-xs text-center">
        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Completude (25%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.completenessScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Consistência (20%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.consistencyScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Integridade (15%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.integrityScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Atualização (15%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.freshnessScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Unicidade (10%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.uniquenessScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Validação (10%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.validationScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-teal-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>

      {/* Grid de 14 Domínios de Dados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdown.domainScores.map((dom) => (
          <div key={dom.domain} className="p-3 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-xs font-bold text-foreground">{dom.domain}</span>
              </div>
              <span className="text-xs font-mono font-bold text-teal-500">
                {dom.score}/100
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all"
                style={{ width: `${dom.score}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
              <span>Audito: {dom.totalRecordsAudited.toLocaleString("pt-BR")}</span>
              <span>Status: <strong className="text-teal-500">{dom.status}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
