"use client";

import React from "react";
import { Code, CheckCircle2, GitBranch, Cpu, Clock, Rocket, ShieldCheck } from "lucide-react";
import { EnterpriseDevExData } from "@/lib/governance/devex";

interface DevExOverviewProps {
  overview: EnterpriseDevExData["overview"];
}

export const DevExOverview: React.FC<DevExOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Developer Experience & CI/CD Governance Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                DEVELOPER_EXPERIENCE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Maturidade técnica do ciclo de engenharia, pipelines CI/CD e prontidão de release (Sprint 2.7)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">DevEx Score</span>
            <span className="text-xl font-mono font-black text-cyan-500">
              {overview.globalDevExScore}/100
            </span>
          </div>
          <div className="pl-3 border-l border-border text-center">
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Grade</span>
            <span className="text-lg font-mono font-black text-emerald-500">{overview.devexGrade}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs font-mono">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Pipelines Auditados</span>
          <span className="text-lg font-bold text-foreground">{overview.totalPipelinesAudited} Workflows</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Tempo Módulo Build</span>
          <span className="text-lg font-bold text-cyan-500">{overview.avgBuildTimeSeconds}s</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Tempo Médio Deploy</span>
          <span className="text-lg font-bold text-cyan-500">{overview.avgDeployTimeSeconds}s</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Release Readiness</span>
          <span className="text-sm font-bold text-emerald-500 block pt-1 font-sans">PASSED (100%)</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Status Arquitetural</span>
          <span className="text-[10px] font-bold text-emerald-500 block pt-1">CICD_GOVERNANCE = LOCKED</span>
        </div>
      </div>
    </div>
  );
};
