"use client";

import React from "react";
import { Clock, AlertTriangle, CheckCircle2, User, ArrowRight } from "lucide-react";
import { FollowUpItem } from "@/lib/commercial-execution";

interface FollowUpPanelProps {
  followUps: FollowUpItem[];
}

export const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ followUps }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Gestão de Follow-ups Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Acompanhamento rigoroso de retornos de propostas, minutas contratuais e pendências comerciais
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          {followUps.length} Follow-ups Registrados
        </span>
      </div>

      <div className="space-y-2.5">
        {followUps.map((fu) => (
          <div
            key={fu.id}
            className="p-3.5 bg-background border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{fu.title}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                    fu.status === "OVERDUE"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }`}
                >
                  {fu.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                <span>Cliente: <strong className="text-foreground font-sans">{fu.customerName}</strong></span>
                <span>Oportunidade: <strong className="text-gold font-sans">{fu.opportunityTitle}</strong></span>
                <span>Responsável: <strong className="text-foreground">{fu.accountManager}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] self-end md:self-center">
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px]">Prazo Limite:</span>
                <span className={`font-bold ${fu.status === "OVERDUE" ? "text-rose-500" : "text-foreground"}`}>
                  {fu.dueDate}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
