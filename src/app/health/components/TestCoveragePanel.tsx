"use client";

import React from "react";
import { CheckCircle, FileCode } from "lucide-react";
import { EnterpriseHealthReport } from "@/lib/governance/observability";

interface TestCoveragePanelProps {
  testSuite: EnterpriseHealthReport["testSuite"];
}

export const TestCoveragePanel: React.FC<TestCoveragePanelProps> = ({ testSuite }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Suíte de Testes Enterprise & Regressão</h3>
            <p className="text-[11px] text-muted-foreground">Validação automatizada contínua das APIs e Engines</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Taxa de Aprovação: {testSuite.passRatePct}%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-3.5 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Total de Testes Executados</span>
          <div className="text-xl font-bold text-foreground">{testSuite.totalTestsCount} suítes passadas</div>
        </div>

        <div className="p-3.5 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Estimativa de Cobertura de Código</span>
          <div className="text-xl font-bold text-emerald-500">{testSuite.coverageEstimatePct}% do escopo analítico</div>
        </div>
      </div>
    </div>
  );
};
