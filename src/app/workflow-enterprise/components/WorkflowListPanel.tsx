"use client";

import React from "react";
import { WorkflowInstance } from "@/lib/workflow-enterprise/types";
import { Layers, ArrowUpRight, Clock, ShieldCheck } from "lucide-react";

interface WorkflowListPanelProps {
  instances: WorkflowInstance[];
  selectedWorkflowId?: string;
  onSelectWorkflow: (wf: WorkflowInstance) => void;
}

export const WorkflowListPanel: React.FC<WorkflowListPanelProps> = ({
  instances,
  selectedWorkflowId,
  onSelectWorkflow,
}) => {
  const getStateBadge = (state: string) => {
    switch (state) {
      case "Approved":
      case "Completed":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Under Review":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "Executing":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "Rejected":
      case "Cancelled":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Returned":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-neutral-800 text-neutral-300 border-neutral-700";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold";
      case "HIGH":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
    }
  };

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            Execuções de Workflows (Workflow Instances)
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Instâncias ativas em execução com controle otimista de concorrência.
          </p>
        </div>
        <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full border border-neutral-700">
          {instances.length} Instâncias
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-400 font-medium">
              <th className="py-3 px-3">Título / ID</th>
              <th className="py-3 px-3">Entidade</th>
              <th className="py-3 px-3">Estado Atual</th>
              <th className="py-3 px-3">Prioridade</th>
              <th className="py-3 px-3">Responsável</th>
              <th className="py-3 px-3">Prazo (SLA)</th>
              <th className="py-3 px-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60">
            {instances.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  Nenhuma instância de workflow encontrada para os filtros selecionados.
                </td>
              </tr>
            ) : (
              instances.map((wf) => {
                const isSelected = wf.workflowId === selectedWorkflowId;
                return (
                  <tr
                    key={wf.workflowId}
                    onClick={() => onSelectWorkflow(wf)}
                    className={`hover:bg-neutral-800/40 transition cursor-pointer ${
                      isSelected ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""
                    }`}
                  >
                    <td className="py-3 px-3">
                      <div className="font-medium text-neutral-100">{wf.title}</div>
                      <div className="font-mono text-[10px] text-neutral-500">{wf.workflowId}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-300">
                      {wf.entityType}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded border text-[11px] font-medium ${getStateBadge(
                          wf.currentState
                        )}`}
                      >
                        {wf.currentState}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[10px] ${getPriorityBadge(
                          wf.priority
                        )}`}
                      >
                        {wf.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-neutral-300">{wf.assignedTo}</td>
                    <td className="py-3 px-3 text-neutral-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {new Date(wf.dueDate).toLocaleDateString("pt-BR")}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWorkflow(wf);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
                      >
                        Detalhes <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
