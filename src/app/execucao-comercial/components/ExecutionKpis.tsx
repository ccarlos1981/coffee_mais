"use client";

import React from "react";
import { Calendar, CheckCircle2, Clock, AlertTriangle, Activity, TrendingUp } from "lucide-react";
import { ExecutionKpisData } from "@/lib/commercial-execution";

interface ExecutionKpisProps {
  kpis: ExecutionKpisData;
}

export const ExecutionKpis: React.FC<ExecutionKpisProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Agendadas Hoje</span>
          <Calendar className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {kpis.scheduledVisitsCount} Compromissos
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Planejamento diário</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Concluídas</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {kpis.completedVisitsCount} Realizadas
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Com registro/check-in</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Aderência Agenda</span>
          <Activity className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg font-mono font-bold text-amber-500">
          {kpis.agendaAdherencePct}%
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Cumprimento de horário</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Follow-ups Pendentes</span>
          <Clock className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-lg font-mono font-bold text-foreground">
          {kpis.pendingFollowUpsCount} Ações
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Aguardando retorno</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Tarefas Atrasadas</span>
          <AlertTriangle className="w-4 h-4 text-rose-500" />
        </div>
        <div className="text-lg font-mono font-bold text-rose-500">
          {kpis.overdueTasksCount} Alerta
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Prazo expirado</span>
      </div>

      <div className="p-4 bg-card border border-border rounded-2xl shadow-sm space-y-1">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[10px] uppercase font-bold tracking-wider">Tempo Médio / Visita</span>
          <Clock className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="text-lg font-mono font-bold text-emerald-500">
          {kpis.avgTimeInVisitMinutes} min
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">Permanência em campo</span>
      </div>
    </div>
  );
};
