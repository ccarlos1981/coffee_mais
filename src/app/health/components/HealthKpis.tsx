"use client";

import React from "react";
import { ShieldCheck, Activity, Cpu, CheckCircle2 } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";

interface HealthKpisProps {
  report: EnterpriseHealthReport;
}

export const HealthKpis: React.FC<HealthKpisProps> = ({ report }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold">Saúde Geral Plataforma</span>
          <Activity className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-500">{report.overallHealthPct}%</div>
        <p className="text-[11px] text-muted-foreground font-mono">Status: Enterprise Operational</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold">Paridade Financeira</span>
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-500">{report.financialParityDesvioPct.toFixed(4)}%</div>
        <p className="text-[11px] text-muted-foreground font-mono">Desvio Relativo Tolerance 0.01%</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold">Latência Média API</span>
          <Cpu className="w-4 h-4 text-gold" />
        </div>
        <div className="text-2xl font-bold font-mono text-foreground">{report.performanceMetrics.avgApiResponseMs} ms</div>
        <p className="text-[11px] text-muted-foreground font-mono">P95: {report.performanceMetrics.p95ApiResponseMs} ms</p>
      </div>

      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold">Cobertura de Testes</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-500">{report.testSuite.coverageEstimatePct}%</div>
        <p className="text-[11px] text-muted-foreground font-mono">{report.testSuite.totalTestsCount} Testes Aprovados</p>
      </div>
    </div>
  );
};
