"use client";

import React from "react";
import { Sliders, DollarSign, TrendingUp, Store } from "lucide-react";
import { CommercialScenarioItem } from "@/lib/commercial-scenarios";

interface ScenarioBuilderPanelProps {
  scenarios: CommercialScenarioItem[];
}

export const ScenarioBuilderPanel: React.FC<ScenarioBuilderPanelProps> = ({ scenarios }) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Modelagem & Construtor de Cenários Estratégicos</h3>
            <p className="text-[11px] text-muted-foreground">
              Simulação de premissas de volume de vendas, alteração de tabela de preços e investimento em campanhas de Trade
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
          {scenarios.length} Cenários Configurados
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenarios.map((scen) => (
          <div
            key={scen.id}
            className="p-4 bg-background border border-border rounded-xl space-y-3 flex flex-col justify-between hover:border-blue-500/40 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-muted text-blue-500 font-mono font-bold text-[9px] uppercase border border-border/40">
                  {scen.type}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                    scen.riskLevel === "LOW"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : scen.riskLevel === "MEDIUM"
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                  }`}
                >
                  Risco {scen.riskLevel}
                </span>
              </div>

              <h4 className="text-xs font-bold text-foreground">{scen.name}</h4>

              <div className="p-2.5 bg-muted/40 rounded-lg border border-border/40 text-[10px] font-mono space-y-1">
                <span className="text-muted-foreground font-sans font-bold block">Premissas Simuladas:</span>
                <div className="flex justify-between">
                  <span>Ajuste Volume:</span>
                  <strong className={scen.premises.volumeAdjustmentPct >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {scen.premises.volumeAdjustmentPct > 0 ? "+" : ""}{scen.premises.volumeAdjustmentPct}%
                  </strong>

                </div>
                <div className="flex justify-between">
                  <span>Ajuste Preço:</span>
                  <strong className="text-foreground">{scen.premises.priceAdjustmentPct}%</strong>
                </div>
                <div className="flex justify-between">
                  <span>Verba Trade:</span>
                  <strong className="text-gold">{formatCurrency(scen.premises.tradeInvestmentAmount)}</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border/40 space-y-1 font-mono text-[11px]">
              <span className="text-[10px] text-muted-foreground block font-sans">Faturamento Projetado:</span>
              <div className="text-base font-bold text-blue-500">
                {formatCurrency(scen.projectedRevenue)}
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                <span>MACO: <strong className="text-foreground">{scen.projectedMacoMarginPct}%</strong></span>
                <span>ROI: <strong className="text-emerald-500">{scen.estimatedRoiRatio}x</strong></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
