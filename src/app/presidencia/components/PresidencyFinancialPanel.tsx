"use client";

import React from "react";
import { DollarSign, TrendingUp, Target, PieChart } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyFinancialPanelProps {
  visaoFinanceira: PresidencyDashboardData["visaoFinanceira"];
  loading?: boolean;
}

export const PresidencyFinancialPanel: React.FC<PresidencyFinancialPanelProps> = ({
  visaoFinanceira,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Consolidação Financeira Executiva</h3>
            <p className="text-[11px] text-muted-foreground">Origem: DRE Comercial & Forecast Comercial</p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Tendência: {visaoFinanceira.tendencia}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Receita Líquida DRE</span>
          <div className="text-lg font-bold text-foreground">{formatCur(visaoFinanceira.receitaLiquidaAtual)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Forecast Fechamento</span>
          <div className="text-lg font-bold text-emerald-500">{formatCur(visaoFinanceira.forecastFechamento)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">Meta Oficial</span>
          <div className="text-lg font-bold text-foreground">{formatCur(visaoFinanceira.metaComercial)}</div>
        </div>

        <div className="bg-background border border-border rounded-xl p-3.5 space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase">MACO Total ({visaoFinanceira.margemMacoPct.toFixed(1)}%)</span>
          <div className="text-lg font-bold text-emerald-500">{formatCur(visaoFinanceira.macoAcumulado)}</div>
        </div>
      </div>
    </div>
  );
};
