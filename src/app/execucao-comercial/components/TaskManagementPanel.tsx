"use client";

import React from "react";
import { CheckSquare, Tag, User, Calendar, AlertTriangle } from "lucide-react";
import { TaskItem } from "@/lib/commercial-execution";

interface TaskManagementPanelProps {
  tasks: TaskItem[];
}

export const TaskManagementPanel: React.FC<TaskManagementPanelProps> = ({ tasks }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Gestão de Tarefas Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de demandas de cadastro, acordos de trade marketing e negociações
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {tasks.length} Tarefas Mapeadas
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tasks.map((tsk) => (
          <div key={tsk.id} className="p-4 bg-background border border-border rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded bg-muted text-emerald-500 font-mono font-bold text-[9px] uppercase border border-border/40">
                {tsk.category}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">{tsk.dueDate}</span>
            </div>

            <h4 className="text-xs font-bold text-foreground line-clamp-2">{tsk.title}</h4>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">Responsável: <strong className="text-foreground">{tsk.assignedTo}</strong></span>
              <span className="text-amber-500 font-bold uppercase">{tsk.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
