"use client";

import React, { useState } from "react";
import { WorkflowInstance, WorkflowDefinition } from "@/lib/workflow-enterprise/types";
import { Cpu, ArrowRight, ShieldAlert, CheckCircle2, Lock } from "lucide-react";

interface WorkflowStateMachinePanelProps {
  instance: WorkflowInstance;
  definition?: WorkflowDefinition;
  onTransition: (targetState: string, comment?: string) => Promise<void>;
}

export const WorkflowStateMachinePanel: React.FC<WorkflowStateMachinePanelProps> = ({
  instance,
  definition,
  onTransition,
}) => {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleExecuteTransition = async (targetState: string) => {
    try {
      setLoading(true);
      setErrorMsg("");
      await onTransition(targetState, comment);
      setComment("");
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao executar transição de estado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber-400" />
            Máquina de Estados & Transições Permitidas
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Estado atual: <span className="font-semibold text-amber-400">{instance.currentState}</span>
          </p>
        </div>
        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
          <Lock className="w-3 h-3" /> Transacional
        </span>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          {errorMsg}
        </div>
      )}

      {/* Available Transition Actions */}
      <div className="mb-4">
        <span className="text-xs text-neutral-400 font-medium block mb-2">Próximos Estados Permitidos:</span>
        <div className="flex flex-wrap items-center gap-2">
          {instance.nextAvailableStates.length === 0 ? (
            <span className="text-xs text-neutral-500 italic">
              Nenhuma transição disponível. O workflow atingiu um estado terminal.
            </span>
          ) : (
            instance.nextAvailableStates.map((state) => (
              <button
                key={state}
                disabled={loading}
                onClick={() => handleExecuteTransition(state)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium px-3.5 py-2 rounded-lg text-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                Transitar para &quot;{state}&quot; <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Comment Input */}
      {instance.nextAvailableStates.length > 0 && (
        <div>
          <label className="text-xs text-neutral-400 font-medium block mb-1">
            Parecer / Comentário da Transição (Opcional):
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Digite observações sobre a transição..."
            rows={2}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      )}
    </div>
  );
};
