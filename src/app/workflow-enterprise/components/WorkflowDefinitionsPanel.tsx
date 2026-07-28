"use client";

import React from "react";
import { WorkflowDefinition } from "@/lib/workflow-enterprise/types";
import { Cpu, CheckCircle, XCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface WorkflowDefinitionsPanelProps {
  definitions: WorkflowDefinition[];
  onSelectDefinition: (def: WorkflowDefinition) => void;
}

export const WorkflowDefinitionsPanel: React.FC<WorkflowDefinitionsPanelProps> = ({
  definitions,
  onSelectDefinition,
}) => {
  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-neutral-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            Modelos e Definições de Workflows (Workflow Definitions)
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Repositório corporativo de máquinas de estado reusáveis e versionadas.
          </p>
        </div>
        <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full border border-neutral-700">
          {definitions.length} Modelos Cadastrados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {definitions.map((def) => (
          <div
            key={def.id}
            onClick={() => onSelectDefinition(def)}
            className="bg-neutral-950/60 border border-neutral-800 hover:border-amber-500/50 rounded-xl p-4 transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-medium text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                  {def.entityType}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-neutral-400">
                  {def.active ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> v{def.version} Ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-400">
                      <XCircle className="w-3 h-3" /> Inativo
                    </span>
                  )}
                </span>
              </div>

              <h3 className="text-sm font-semibold text-neutral-100 group-hover:text-amber-400 transition mb-1">
                {def.name}
              </h3>
              <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                {def.description}
              </p>
            </div>

            <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1 text-neutral-400">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-500" />
                {def.approvalPolicies.length} Política(s)
              </span>
              <span className="text-amber-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition">
                Ver Regras <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
