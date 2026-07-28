"use client";

import React from "react";
import { Clock, CheckCircle2, Shield, Info, AlertTriangle } from "lucide-react";
import { SecurityTimelineEvent } from "@/lib/governance/security";

interface SecurityTimelineProps {
  timeline: SecurityTimelineEvent[];
}

export const SecurityTimeline: React.FC<SecurityTimelineProps> = ({ timeline }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Linha do Tempo de Auditorias de Segurança</h3>
          <p className="text-[11px] text-muted-foreground">
            Histórico cronológico de verificações RLS, RBAC e segredos do ambiente
          </p>
        </div>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
        {timeline.map((evt) => (
          <div key={evt.id} className="relative flex items-start justify-between gap-3 text-xs">
            <div className="absolute -left-6 top-1 p-1 rounded-full bg-card border border-border text-emerald-500">
              <CheckCircle2 className="w-3 h-3" />
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-mono text-muted-foreground block">
                {new Date(evt.timestamp).toLocaleString("pt-BR")}
              </span>
              <p className="font-semibold text-foreground">{evt.description}</p>
            </div>

            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted text-emerald-500 border border-border/50">
              {evt.eventType}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
