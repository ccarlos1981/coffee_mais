"use client";

import React from "react";
import { Clock, MessageSquare, Phone, Mail, Calendar, FileText, CheckCircle2, ArrowRight } from "lucide-react";
import { TimelineInteractionItem } from "@/lib/crm-enterprise";

interface CrmTimelinePanelProps {
  timeline: TimelineInteractionItem[];
}

export const CrmTimelinePanel: React.FC<CrmTimelinePanelProps> = ({ timeline }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Timeline Comercial (Histórico Cronológico de Interações)</h3>
            <p className="text-[11px] text-muted-foreground">
              Registro completo de visitas, reuniões, ligações, e-mails, negociações e acordos
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-gold/10 text-gold border border-gold/20">
          {timeline.length} Interações Registradas
        </span>
      </div>

      <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/60">
        {timeline.map((item) => (
          <div key={item.id} className="relative pl-8 space-y-2">
            {/* Ícone do tipo */}
            <div className="absolute left-1 top-1.5 p-1 rounded-full bg-gold text-background border border-gold">
              {item.type === "VISIT" && <Calendar className="w-3 h-3" />}
              {item.type === "MEETING" && <Calendar className="w-3 h-3" />}
              {item.type === "CALL" && <Phone className="w-3 h-3" />}
              {item.type === "WHATSAPP" && <MessageSquare className="w-3 h-3" />}
              {item.type === "EMAIL" && <Mail className="w-3 h-3" />}
              {item.type === "NEGOTIATION" && <FileText className="w-3 h-3" />}
              {item.type === "PROPOSAL" && <FileText className="w-3 h-3" />}
            </div>

            <div className="p-3.5 bg-background border border-border rounded-xl space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground font-sans">{item.customerName}</span>
                  <span className="px-2 py-0.5 rounded bg-muted text-gold font-bold text-[9px]">
                    {item.type}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {item.timestamp} • {item.author}
                </span>
              </div>

              <h4 className="text-xs font-bold text-foreground">{item.summary}</h4>
              <p className="text-[11px] text-muted-foreground">{item.details}</p>

              {item.nextStep && (
                <div className="pt-2 border-t border-border/40 text-[10px] font-mono text-gold flex items-center gap-1.5">
                  <ArrowRight className="w-3 h-3" />
                  <span>Próximo Passo: <strong className="text-foreground">{item.nextStep}</strong></span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
