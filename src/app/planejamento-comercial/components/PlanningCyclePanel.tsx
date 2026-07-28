"use client";

import React from "react";
import { Calendar, CheckCircle2, Clock, ArrowRight, GitCommit, User } from "lucide-react";
import { PlanningCycleItem } from "@/lib/commercial-planning";

interface PlanningCyclePanelProps {
  cycles: PlanningCycleItem[];
  workflowHistory: { phase: string; date: string; user: string; notes: string }[];
}

export const PlanningCyclePanel: React.FC<PlanningCyclePanelProps> = ({ cycles, workflowHistory }) => {
  const phases = [
    { id: "ELABORATION", label: "1. Elaboração Comercial" },
    { id: "SALES_REVIEW", label: "2. Revisão de Vendas" },
    { id: "SOP_ALIGNMENT", label: "3. Alinhamento S&OP" },
    { id: "BOARD_APPROVAL", label: "4. Aprovação Diretoria" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Ciclos de Planejamento S&OP Comercial</h3>
              <p className="text-[11px] text-muted-foreground">
                Fluxo de governança de elaboração, validação e aprovação do Plano Comercial Oficial
              </p>
            </div>
          </div>
        </div>

        {cycles.map((cyc) => (
          <div key={cyc.id} className="p-4 bg-background border border-border rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">{cyc.horizon}</span>
                <h4 className="text-sm font-bold text-foreground">{cyc.name}</h4>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-xl border border-indigo-500/20">
                  {cyc.completionPct}% Concluído
                </span>
                <span className="text-xs font-bold text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded bg-emerald-500/10">
                  {cyc.status}
                </span>
              </div>
            </div>

            {/* Stepper de Fases */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 font-mono text-xs">
              {phases.map((p, idx) => {
                const isCurrent = cyc.currentPhase === p.id;
                const isPast = idx < 2; // Simulação de progresso

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border space-y-1 transition-all ${
                      isCurrent
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-500 font-bold"
                        : isPast
                        ? "bg-muted/40 border-border/60 text-muted-foreground"
                        : "bg-background border-border/40 text-muted-foreground/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-sans uppercase font-bold">{p.label}</span>
                      {isPast && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Histórico do Workflow */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold text-foreground border-b border-border pb-2">
          Histórico de Alterações e Notas do Workflow S&OP
        </h4>
        <div className="space-y-2 font-mono text-xs">
          {workflowHistory.map((w, idx) => (
            <div key={idx} className="p-3 bg-background border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-foreground font-sans">{w.phase}</span>
                <p className="text-[11px] text-muted-foreground font-sans">{w.notes}</p>
              </div>
              <span className="text-[10px] text-muted-foreground self-end sm:self-auto">
                {w.date} • {w.user}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
