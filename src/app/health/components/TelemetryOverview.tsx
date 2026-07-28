"use client";

import React from "react";
import { Activity, ShieldCheck, Users, Monitor, Smartphone, Clock, EyeOff } from "lucide-react";
import { EnterpriseTelemetryData } from "@/lib/governance/telemetry";

interface TelemetryOverviewProps {
  overview: EnterpriseTelemetryData["overview"];
}

export const TelemetryOverview: React.FC<TelemetryOverviewProps> = ({ overview }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Enterprise Operational Telemetry & Usage Analytics Overview
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                TELEMETRY_ENTERPRISE = LOCKED
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Telemetria operacional puramente agregada, LGPD Compliant e diagnóstica (Sprint 2.6)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-background border border-border p-2.5 rounded-xl">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase block">Adoption Score</span>
            <span className="text-xl font-mono font-black text-amber-500">
              {overview.globalAdoptionScore}/100
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Sessões Agregadas</span>
          <span className="text-lg font-bold text-foreground">{overview.totalAggregatedSessions.toLocaleString("pt-BR")}</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Módulos Ativos</span>
          <span className="text-lg font-bold text-foreground">{overview.activeModulesCount} Módulos</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Duração Média</span>
          <span className="text-lg font-bold text-amber-500">{overview.avgSessionDurationMinutes} min</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Desktop Share</span>
          <span className="text-lg font-bold text-amber-500">{overview.desktopAccessPct}%</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Mobile Share</span>
          <span className="text-lg font-bold text-amber-500">{overview.mobileAccessPct}%</span>
        </div>

        <div className="p-3 bg-background border border-border rounded-xl space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase block font-sans">Privacidade & LGPD</span>
          <span className="text-[10px] font-bold text-emerald-500 block pt-1">AGGREGATED & ANONYMIZED</span>
        </div>
      </div>
    </div>
  );
};
