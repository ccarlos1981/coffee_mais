"use client";

import React from "react";
import { Navigation, Calendar, Target, CheckCircle2, Package } from "lucide-react";
import { VisitPlanItem } from "@/lib/commercial-execution";

interface VisitPlanningPanelProps {
  visitPlans: VisitPlanItem[];
}

export const VisitPlanningPanel: React.FC<VisitPlanningPanelProps> = ({ visitPlans }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Navigation className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Planejamento & Roteirização de Visitas</h3>
            <p className="text-[11px] text-muted-foreground">
              Sugestões preditivas de visitas com base na frequência de atendimento e score de criticidade
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          {visitPlans.length} Roteiros Sugeridos
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visitPlans.map((vp) => (
          <div key={vp.id} className="p-4 bg-background border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <div>
                <h4 className="text-xs font-bold text-foreground">{vp.customerName}</h4>
                <span className="text-[10px] font-mono text-muted-foreground">Gerente: {vp.accountManager}</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Score: {vp.priorityScore}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] text-muted-foreground font-sans block">Motivo da Sugestão:</span>
              <p className="text-[11px] text-foreground font-medium bg-muted/30 p-2 rounded border border-border/40">
                {vp.reason}
              </p>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] text-muted-foreground font-sans block flex items-center gap-1">
                <Package className="w-3 h-3 text-gold" />
                Foco de Mix de Produtos:
              </span>
              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                {vp.recommendedProducts.map((p, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 rounded bg-muted text-gold border border-border/40 font-bold">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] font-mono">
              <span className="text-muted-foreground">Data Sugerida: <strong className="text-foreground">{vp.suggestedDate}</strong></span>
              <span className="text-emerald-500 font-bold uppercase">{vp.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
