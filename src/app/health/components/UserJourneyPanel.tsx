"use client";

import React from "react";
import { GitCommit, ArrowRight, CheckCircle2, UserCheck } from "lucide-react";
import { UserJourneyItem } from "@/lib/governance/telemetry";

interface UserJourneyPanelProps {
  userJourneys: UserJourneyItem[];
}

export const UserJourneyPanel: React.FC<UserJourneyPanelProps> = ({ userJourneys }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
          <GitCommit className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Jornadas dos Usuários & Fluxos Predominantes (Frente 3)</h3>
          <p className="text-[11px] text-muted-foreground">
            Mapeamento agregado de sequências de navegação, taxa de conclusão e tempo por jornada
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {userJourneys.map((item) => (
          <div key={item.id} className="p-4 bg-background border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground font-sans">{item.journeyName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                {item.completionRatePct}% Conclusão
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              {item.primaryFlow.map((step, idx) => (
                <React.Fragment key={idx}>
                  <span className="px-2 py-0.5 rounded bg-muted/60 text-foreground border border-border/50">
                    {step}
                  </span>
                  {idx < item.primaryFlow.length - 1 && <ArrowRight className="w-3 h-3 text-amber-500" />}
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-2 border-t border-border/50">
              <span>Perfil Predominante: <strong className="text-foreground">{item.predominantRole}</strong></span>
              <span>Duração Média: <strong className="text-amber-500">{item.avgDurationMinutes} min</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
