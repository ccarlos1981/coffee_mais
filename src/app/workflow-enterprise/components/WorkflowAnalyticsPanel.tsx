"use client";

import React from "react";
import { WorkflowAnalyticsSummary } from "@/lib/workflow-enterprise/types";
import { BarChart3, TrendingUp, CheckCircle2, Clock, ShieldCheck } from "lucide-react";

interface WorkflowAnalyticsPanelProps {
  analytics: WorkflowAnalyticsSummary;
}

export const WorkflowAnalyticsPanel: React.FC<WorkflowAnalyticsPanelProps> = ({ analytics }) => {
  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Métricas & Analytics de Eficiência dos Workflows
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Análise agregada de tempo de ciclo, conformidade de SLA e distribuição de instâncias por estado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribution by State */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-neutral-200 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Instâncias por Estado
          </h4>
          <div className="space-y-2">
            {Object.entries(analytics.instancesByState).map(([state, count]) => (
              <div key={state} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">{state}</span>
                <span className="font-mono font-semibold text-neutral-200 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution by Entity Type */}
        <div className="bg-neutral-950/60 border border-neutral-800 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-neutral-200 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Instâncias por Tipo de Entidade
          </h4>
          <div className="space-y-2">
            {Object.entries(analytics.instancesByEntityType).map(([entityType, count]) => (
              <div key={entityType} className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-mono">{entityType}</span>
                <span className="font-mono font-semibold text-amber-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
