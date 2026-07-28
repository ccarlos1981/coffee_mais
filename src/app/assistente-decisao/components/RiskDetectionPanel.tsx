"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, ArrowRight, DollarSign } from "lucide-react";
import { RiskAnalysisItem } from "@/lib/commercial-decision";

interface RiskDetectionPanelProps {
  risks: RiskAnalysisItem[];
}

export const RiskDetectionPanel: React.FC<RiskDetectionPanelProps> = ({ risks }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Radar de Detecção Antecipada de Riscos Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Alertas proativos de churn, desengajamento presencial, atritos contratuais e queda de volume
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
          {risks.length} Alertas Ativos
        </span>
      </div>

      <div className="space-y-3">
        {risks.map((rk) => (
          <div
            key={rk.id}
            className="p-4 bg-background border border-border rounded-xl space-y-3 hover:border-rose-500/40 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
              <div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase block">Gerente: {rk.accountManager}</span>
                <h4 className="text-xs font-bold text-foreground font-sans">{rk.customerName}</h4>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold border border-rose-500/20">
                  Severidade: {rk.severityScore}/100
                </span>
                <span className="text-xs font-bold text-rose-500">
                  {formatCurrency(rk.revenueAtRisk)} em Risco
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-muted/30 rounded-lg border border-border/40 space-y-1">
                <span className="text-[10px] text-muted-foreground font-sans font-bold block">Causa Raiz Identificada:</span>
                <p className="text-[11px] text-foreground font-medium">{rk.rootCause}</p>
              </div>

              <div className="p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/20 space-y-1">
                <span className="text-[10px] text-emerald-500 font-sans font-bold block flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> Mitigação Recomendada:
                </span>
                <p className="text-[11px] text-foreground font-medium">{rk.suggestedMitigation}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
