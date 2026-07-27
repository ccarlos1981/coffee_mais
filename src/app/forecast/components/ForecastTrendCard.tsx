"use client";

import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ForecastTrendCardProps {
  tendencia: "CRESCIMENTO" | "ESTABILIDADE" | "QUEDA";
  loading?: boolean;
}

export const ForecastTrendCard: React.FC<ForecastTrendCardProps> = ({
  tendencia,
  loading = false,
}) => {
  const getBadgeStyle = () => {
    switch (tendencia) {
      case "CRESCIMENTO":
        return {
          icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
          label: "🚀 Tendência de Crescimento",
          desc: "Projeção superando a Meta Oficial do mês.",
          color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
        };
      case "ESTABILIDADE":
        return {
          icon: <Minus className="w-5 h-5 text-amber-500" />,
          label: "⚖️ Tendência de Estabilidade",
          desc: "Projeção alinhada com a faixa aceitável da meta.",
          color: "border-amber-500/30 bg-amber-500/10 text-amber-500",
        };
      case "QUEDA":
        return {
          icon: <TrendingDown className="w-5 h-5 text-rose-500" />,
          label: "📉 Tendência de Queda",
          desc: "Projeção abaixo do ritmo necessário para a meta.",
          color: "border-rose-500/30 bg-rose-500/10 text-rose-500",
        };
    }
  };

  const style = getBadgeStyle();

  return (
    <div className={`border rounded-2xl p-5 shadow-sm space-y-2 ${style.color}`}>
      <div className="flex items-center gap-2">
        {style.icon}
        <h3 className="text-sm font-bold">{style.label}</h3>
      </div>
      <p className="text-xs opacity-90">{style.desc}</p>
    </div>
  );
};
