"use client";

import React from "react";
import { PieChart } from "lucide-react";
import { ForecastRentabilidade } from "@/lib/governance/analytics/forecast";

interface ForecastRentabilidadeCardProps {
  rentabilidade: ForecastRentabilidade;
  loading?: boolean;
}

export const ForecastRentabilidadeCard: React.FC<ForecastRentabilidadeCardProps> = ({
  rentabilidade,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Forecast de Rentabilidade (Cascata DRE)</h3>
            <p className="text-[11px] text-muted-foreground">Projeção da Margem MACO e custos operacionais</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 font-mono text-xs">
        <div className="flex justify-between py-1.5 border-b border-border">
          <span className="text-muted-foreground">(+) Receita Líquida Projetada</span>
          <span className="font-bold text-foreground">{formatCur(rentabilidade.receitaLiquida)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border">
          <span className="text-muted-foreground">(-) CPV Projetado (48%)</span>
          <span className="text-rose-500">-{formatCur(rentabilidade.cpv)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border">
          <span className="text-muted-foreground">(-) Impostos Projetados (14%)</span>
          <span className="text-rose-500">-{formatCur(rentabilidade.impostos)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border">
          <span className="text-muted-foreground">(-) Frete Projetado (3% Fixo)</span>
          <span className="text-rose-500">-{formatCur(rentabilidade.frete)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-border">
          <span className="text-muted-foreground">(-) Investimento Comercial</span>
          <span className="text-rose-500">-{formatCur(rentabilidade.investimentoComercial)}</span>
        </div>
        <div className="flex justify-between py-2 bg-emerald-500/10 px-3 rounded-xl border border-emerald-500/20">
          <span className="font-bold text-emerald-500">(=) MACO Projetado ({rentabilidade.margemMacoPercentual.toFixed(1)}%)</span>
          <span className="font-black text-emerald-500">{formatCur(rentabilidade.maco)}</span>
        </div>
      </div>
    </div>
  );
};
