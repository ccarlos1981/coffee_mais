"use client";

import React from "react";
import { Award, Layers, Shield, CheckCircle2 } from "lucide-react";
import { ComplianceScoreBreakdown } from "@/lib/governance/security";

interface ComplianceScoreCardProps {
  breakdown: ComplianceScoreBreakdown;
}

export const ComplianceScoreCard: React.FC<ComplianceScoreCardProps> = ({ breakdown }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Compliance Score por Módulo & Componente</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação ponderada oficial (25% Auth | 20% Autorização | 15% RLS | 15% APIs | 10% Ambiente | 10% Dependências | 5% Governança)
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Global: {breakdown.globalComplianceScore}/100
        </span>
      </div>

      {/* Breakdown dos Componentes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-xs text-center">
        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Auth (25%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.authScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">RBAC (20%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.authorizationScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">RLS (15%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.rlsScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">APIs (15%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.apiScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Ambiente (10%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.environmentScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Deps (10%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.dependencyScore}%</span>
        </div>

        <div className="p-2 bg-background border border-border rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground block font-sans">Gov (5%)</span>
          <span className="font-bold text-emerald-500">{breakdown.componentScores.governanceScore}%</span>
        </div>
      </div>

      {/* Grid de Scores dos Módulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {breakdown.moduleScores.map((mod) => (
          <div key={mod.module} className="p-3 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gold" />
                <span className="text-xs font-bold text-foreground">{mod.module}</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-500">
                {mod.complianceScore}/100
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                style={{ width: `${mod.complianceScore}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
              <span>Auth: {mod.authScore}%</span>
              <span>RBAC: {mod.rbacScore}%</span>
              <span>RLS: {mod.rlsScore}%</span>
              <span>APIs: {mod.apiScore}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
