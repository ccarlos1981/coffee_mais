"use client";

import React from "react";
import { Clock, Users, CheckCircle2 } from "lucide-react";
import { SessionAnalyticsItem } from "@/lib/governance/telemetry";

interface SessionAnalyticsPanelProps {
  sessionAnalytics: SessionAnalyticsItem[];
}

export const SessionAnalyticsPanel: React.FC<SessionAnalyticsPanelProps> = ({ sessionAnalytics }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Análise de Sessões por Perfil (Frente 5)</h3>
          <p className="text-[11px] text-muted-foreground">
            Duração média, páginas/sessão e profundidade de navegação por papel
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {sessionAnalytics.map((item) => (
          <div key={item.roleCategory} className="p-3.5 bg-background border border-border rounded-xl space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground font-sans">{item.roleCategory}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 font-sans">
                {item.depthScore}
              </span>
            </div>

            <div className="space-y-1 text-muted-foreground text-[11px]">
              <div className="flex justify-between">
                <span>Duração Média:</span>
                <strong className="text-amber-500">{item.avgSessionDurationMinutes} min</strong>
              </div>
              <div className="flex justify-between">
                <span>Páginas / Sessão:</span>
                <strong className="text-foreground">{item.pagesPerSession} pgs</strong>
              </div>
              <div className="flex justify-between">
                <span>Tempo / Página:</span>
                <strong className="text-foreground">{item.timePerPageSeconds}s</strong>
              </div>
            </div>

            <div className="pt-2 border-t border-border/50 text-[10px] text-emerald-500 flex justify-between font-sans">
              <span>Engajamento da Carteira:</span>
              <span className="font-bold">{item.activeUsersPct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
