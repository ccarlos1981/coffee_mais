"use client";

import React from "react";
import { CheckSquare, Calendar, User, CheckCircle2, FileCheck } from "lucide-react";
import { ActionPlanItem } from "@/lib/crm-enterprise";

interface CrmPlanoAcaoPanelProps {
  actionPlans: ActionPlanItem[];
}

export const CrmPlanoAcaoPanel: React.FC<CrmPlanoAcaoPanelProps> = ({ actionPlans }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Planos de Ação & Checklists de Oportunidades</h3>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento de prazos, responsáveis, evidências de execução e tarefas pendentes
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-gold/10 text-gold border border-gold/20">
          {actionPlans.length} Planos Ativos
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actionPlans.map((ap) => (
          <div key={ap.id} className="p-4 bg-background border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">{ap.customerName}</span>
                <h4 className="text-xs font-bold text-foreground">{ap.title}</h4>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  ap.priority === "URGENT" || ap.priority === "HIGH"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }`}
              >
                {ap.priority}
              </span>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-muted-foreground font-sans block">Checklist de Tarefas:</span>
              {ap.checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-[11px]">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${item.done ? "text-emerald-500" : "text-muted-foreground/50"}`}
                  />
                  <span className={item.done ? "line-through text-muted-foreground" : "text-foreground"}>
                    {item.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/40 font-sans">
              <span>Responsável: <strong className="text-foreground font-mono">{ap.accountManager}</strong></span>
              <span>Prazo: <strong className="text-gold font-mono">{ap.dueDate}</strong></span>
              <span>Evidências: <strong className="text-emerald-500 font-mono">{ap.evidenceCount} anexos</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
