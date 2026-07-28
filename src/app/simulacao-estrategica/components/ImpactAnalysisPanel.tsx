"use client";

import React from "react";
import { BarChart3, TrendingUp, DollarSign } from "lucide-react";

export const ImpactAnalysisPanel: React.FC = () => {
  const channelImpacts = [
    { channel: "Key Account / Redes", baseRev: 3850000, projectedRev: 4427500, deltaPct: 15.0, status: "HIGH_IMPACT" },
    { channel: "Distribuidores Regionais", baseRev: 1450000, projectedRev: 1624000, deltaPct: 12.0, status: "MEDIUM_IMPACT" },
    { channel: "Varejo Independente / PDV", baseRev: 852988, projectedRev: 1024436, deltaPct: 20.1, status: "HIGH_IMPACT" },
  ];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Análise de Impacto Financeiro por Canal Comercial</h3>
          <p className="text-[11px] text-muted-foreground">
            Desdobramento da variação de faturamento simulada entre os canais de atendimento
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {channelImpacts.map((ch, idx) => (
          <div
            key={idx}
            className="p-4 bg-background border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
          >
            <div>
              <span className="font-bold text-foreground text-xs">{ch.channel}</span>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono pt-1">
                <span>Base: <strong className="text-foreground">{formatCurrency(ch.baseRev)}</strong></span>
                <span>Projetado: <strong className="text-emerald-500">{formatCurrency(ch.projectedRev)}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                +{ch.deltaPct}% Variação
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
