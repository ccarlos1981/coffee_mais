"use client";

import React from "react";
import { CheckCircle2, ShieldCheck, Cpu, Award, Zap, Layers } from "lucide-react";
import { EnterpriseQualityData } from "@/lib/governance/quality";

interface QualityOverviewProps {
  overview: EnterpriseQualityData["overview"];
}

export const QualityOverview: React.FC<QualityOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Test Automation & Quality Assurance Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                QUALITY_ASSURANCE_ENTERPRISE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Validação contínua de estabilidade, cobertura de testes, validação de build e regressões (Sprint 2.5)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block">Quality Score</span>
            <span className="text-xl font-mono font-black text-indigo-500">
              {overview.globalQualityScore}/100
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Total de Testes</span>
          <span className="text-lg font-bold text-foreground">{overview.totalTestsCount} Testes</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Aprovados</span>
          <span className="text-lg font-bold text-emerald-500">{overview.totalPassCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Falhas</span>
          <span className="text-lg font-bold text-emerald-500">{overview.totalFailCount}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Taxa de Sucesso</span>
          <span className="text-lg font-bold text-indigo-500">{overview.overallPassRatePct}%</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Cobertura Média</span>
          <span className="text-lg font-bold text-indigo-500">{overview.overallCoveragePct}%</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Validação de Build</span>
          <span className="text-sm font-bold text-emerald-500 block pt-0.5">{overview.buildValidationStatus}</span>
        </div>
      </div>
    </div>
  );
};
