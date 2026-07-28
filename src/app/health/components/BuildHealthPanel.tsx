"use client";

import React from "react";
import { Cpu, Zap, CheckCircle2 } from "lucide-react";
import { BuildHealthMetrics } from "@/lib/governance/devex";

interface BuildHealthPanelProps {
  buildHealth: BuildHealthMetrics;
}

export const BuildHealthPanel: React.FC<BuildHealthPanelProps> = ({ buildHealth }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
          <Cpu className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Saúde dos Builds & Compilação Turbopack</h3>
          <p className="text-[11px] text-muted-foreground">
            Métricas de compilação Next.js 16 de produção, geração de páginas estáticas e verificação de tipos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs text-center">
        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Build Duration</span>
          <span className="font-bold text-cyan-500">{buildHealth.avgBuildDurationSeconds}s</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">TypeCheck Time</span>
          <span className="font-bold text-cyan-500">{buildHealth.avgTypeCheckDurationSeconds}s</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Turbopack Compile</span>
          <span className="font-bold text-emerald-500">{buildHealth.turbopackCompilationTimeMs}ms</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Páginas Compiladas</span>
          <span className="font-bold text-foreground">{buildHealth.totalPagesCompiled} Rotas</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Build Success Rate</span>
          <span className="font-bold text-emerald-500">{buildHealth.buildSuccessRatePct}%</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl">
          <span className="text-[10px] text-muted-foreground block font-sans">Status Compilação</span>
          <span className="font-bold text-emerald-500 font-sans">{buildHealth.compilationStatus}</span>
        </div>
      </div>
    </div>
  );
};
