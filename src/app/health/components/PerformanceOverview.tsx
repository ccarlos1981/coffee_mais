"use client";

import React from "react";
import { Zap, Cpu, Box, Database } from "lucide-react";
import { EnterprisePerformanceData } from "@/lib/governance/performance";

interface PerformanceOverviewProps {
  overview: EnterprisePerformanceData["overview"];
}

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({ overview }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Performance Score Global</span>
          <Zap className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.globalPerformanceScore}/100</div>
        <p className="text-[11px] text-muted-foreground">Otimização Nível Enterprise</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Execução Média Engines</span>
          <Cpu className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.avgEngineExecutionMs} ms</div>
        <p className="text-[11px] text-muted-foreground">Respostas Ultrarápidas</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Tamanho Total Bundles</span>
          <Box className="w-4 h-4 text-gold" />
        </div>
        <div className="text-2xl font-bold text-foreground">{overview.totalBundleSizeKb} KB</div>
        <p className="text-[11px] text-muted-foreground">Code Splitting Ativo</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground font-sans">
          <span className="text-xs font-semibold">Consultas Analíticas</span>
          <Database className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold text-emerald-500">{overview.totalOptimizedQueries} Fontes</div>
        <p className="text-[11px] text-muted-foreground">Views Materializadas Homologadas</p>
      </div>
    </div>
  );
};
