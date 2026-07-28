"use client";

import React from "react";
import { WorkflowAnalyticsSummary } from "@/lib/workflow-enterprise/types";
import { Layers, CheckCircle2, Clock, ShieldAlert, Cpu } from "lucide-react";

interface WorkflowKpisProps {
  analytics: WorkflowAnalyticsSummary;
}

export const WorkflowKpis: React.FC<WorkflowKpisProps> = ({ analytics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* Total Instâncias */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Instâncias Totais</span>
          <span className="text-xl font-bold text-neutral-100">{analytics.totalInstances}</span>
        </div>
      </div>

      {/* Modelos Ativos */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Modelos Ativos</span>
          <span className="text-xl font-bold text-neutral-100">{analytics.activeDefinitions}</span>
        </div>
      </div>

      {/* Aprovações Pendentes */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Fila de Aprovação</span>
          <span className="text-xl font-bold text-orange-400">{analytics.pendingApprovalsCount}</span>
        </div>
      </div>

      {/* Tempo Médio de Ciclo */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Tempo Médio Ciclo</span>
          <span className="text-xl font-bold text-emerald-400">{analytics.averageCycleTimeHours}h</span>
        </div>
      </div>

      {/* Conformidade SLA */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex items-center gap-4 shadow-sm backdrop-blur-md">
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Conformidade SLA</span>
          <span className="text-xl font-bold text-purple-400">{analytics.slaCompliancePct}%</span>
        </div>
      </div>
    </div>
  );
};
