"use client";

import React from "react";
import { WorkflowInstance } from "@/lib/workflow-enterprise/types";
import { History, ShieldCheck, Zap } from "lucide-react";

interface WorkflowTimelinePanelProps {
  instance: WorkflowInstance;
}

export const WorkflowTimelinePanel: React.FC<WorkflowTimelinePanelProps> = ({ instance }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Audit Trail */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
        <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          Trilha de Auditoria Imutável (Audit Trail)
        </h3>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {instance.auditTrail.length === 0 ? (
            <span className="text-xs text-neutral-500 italic">Nenhum registro de auditoria.</span>
          ) : (
            instance.auditTrail.map((aud) => (
              <div key={aud.id} className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between text-neutral-400 mb-1">
                  <span className="font-semibold text-neutral-200">{aud.userName} ({aud.userRole})</span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {new Date(aud.timestamp).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="text-amber-400 font-mono text-[11px] mb-1">{aud.action}</div>
                <div className="text-neutral-300">
                  Estado: <span className="text-neutral-400">{aud.fromState}</span> →{" "}
                  <strong className="text-amber-400">{aud.toState}</strong>
                </div>
                {aud.comment && (
                  <p className="text-neutral-400 italic text-[11px] mt-1 bg-neutral-900/80 p-1.5 rounded">
                    &quot;{aud.comment}&quot;
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Domain Events Log v1 */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm backdrop-blur-md">
        <h3 className="text-sm font-semibold text-neutral-100 flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-blue-400" />
          Barramento de Eventos de Domínio (v1)
        </h3>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {instance.eventsLog.length === 0 ? (
            <span className="text-xs text-neutral-500 italic">Nenhum evento emitido.</span>
          ) : (
            instance.eventsLog.map((evt) => (
              <div key={evt.eventId} className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                    {evt.eventType} {evt.eventVersion}
                  </span>
                  <span className="font-mono text-[10px] text-neutral-500">
                    {new Date(evt.occurredAt).toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-neutral-400 mt-1">
                  eventId: {evt.eventId}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
