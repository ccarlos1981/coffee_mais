"use client";

import React from "react";
import { Layers, ShieldCheck, Box, Network, BookOpen, CheckCircle2 } from "lucide-react";
import { EnterpriseArchitectureData } from "@/lib/governance/architecture";

interface ArchitectureOverviewProps {
  overview: EnterpriseArchitectureData["overview"];
}

export const ArchitectureOverview: React.FC<ArchitectureOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Architecture & Documentation Governance Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-500 border border-teal-500/20">
                ARCHITECTURE_ENTERPRISE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Estrutura técnica, inventário de ativos e grafo de dependências da plataforma (Sprint 2.8)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Architecture Score</span>
            <span className="text-xl font-mono font-black text-teal-500">
              {overview.globalArchitectureScore}/100
            </span>
          </div>
          <div className="pl-3 border-l border-border text-center">
            <span className="text-[10px] text-muted-foreground uppercase block font-sans">Desacoplamento</span>
            <span className="text-xs font-mono font-bold text-emerald-500">{overview.decouplingGrade}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 text-xs font-mono">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Engines Homologadas</span>
          <span className="text-lg font-bold text-foreground">{overview.totalEnginesAudited} Motores</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Rotas de API</span>
          <span className="text-lg font-bold text-teal-500">{overview.totalApisAudited} HTTP Routes</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Documentação Viva</span>
          <span className="text-sm font-bold text-emerald-500 block pt-1 font-sans">74 Seções AGENTS.md</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Isolamento de Dados</span>
          <span className="text-sm font-bold text-emerald-500 block pt-1 font-sans">100% SINGLE_SOURCE</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Status Arquitetural</span>
          <span className="text-[10px] font-bold text-emerald-500 block pt-1">DOCUMENTATION = LOCKED</span>
        </div>
      </div>
    </div>
  );
};
