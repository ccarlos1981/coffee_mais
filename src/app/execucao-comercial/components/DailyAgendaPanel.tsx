"use client";

import React from "react";
import { Clock, MapPin, CheckCircle2, Phone, Calendar, ArrowRight, User } from "lucide-react";
import { AgendaEventItem } from "@/lib/commercial-execution";

interface DailyAgendaPanelProps {
  agenda: AgendaEventItem[];
}

export const DailyAgendaPanel: React.FC<DailyAgendaPanelProps> = ({ agenda }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Agenda Comercial Corporativa (Cronograma Diário)</h3>
            <p className="text-[11px] text-muted-foreground">
              Compromissos presenciais e remotos ordenados por horário e status de atendimento
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {agenda.length} Eventos Agendados
        </span>
      </div>

      <div className="space-y-3">
        {agenda.map((ev) => (
          <div
            key={ev.id}
            className="p-4 bg-background border border-border rounded-xl shadow-xs hover:border-emerald-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-muted border border-border/50 text-center font-mono font-bold text-xs text-foreground">
                {ev.time}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground text-xs">{ev.title}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                      ev.priority === "HIGH"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    }`}
                  >
                    {ev.priority}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>Cliente: <strong className="text-foreground font-sans">{ev.customerName}</strong></span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-500" />
                    {ev.address}
                  </span>
                  <span>Gerente: <strong className="text-foreground">{ev.accountManager}</strong></span>
                </div>

                <div className="text-[11px] text-foreground bg-muted/40 p-2 rounded-lg border border-border/40 font-mono mt-1">
                  <span className="text-[10px] text-muted-foreground block font-sans">Objetivo da Visita:</span>
                  <span>{ev.objective}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center font-mono">
              <span
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                  ev.status === "COMPLETED"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : ev.status === "IN_PROGRESS"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}
              >
                {ev.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
