"use client";

import React from "react";
import { BarChart3, TrendingUp, Sliders } from "lucide-react";
import { CommercialScenarioData } from "@/lib/commercial-scenarios";

interface ScenarioAnalyticsPanelProps {
  data: CommercialScenarioData;
}

export const ScenarioAnalyticsPanel: React.FC<ScenarioAnalyticsPanelProps> = ({ data }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Analytics de Sensibilidade & Prospectiva</h3>
          <p className="text-[11px] text-muted-foreground">
            Curva de resposta do faturamento simulado a alterações de preço e verba de trade
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <span className="text-[10px] text-muted-foreground font-sans font-bold uppercase block">
            Sensibilidade de Volume × Margem MACO
          </span>
          <p className="text-[11px] text-foreground font-sans">
            Cada variação de 5% no volume físico faturado altera a margem MACO em aproximadamente 1.2 pontos percentuais.
          </p>
        </div>

        <div className="p-4 bg-background border border-border rounded-xl space-y-2">
          <span className="text-[10px] text-muted-foreground font-sans font-bold uppercase block">
            Eficiência da Verba de Trade Marketing
          </span>
          <p className="text-[11px] text-foreground font-sans">
            A ROI média estimada das campanhas de Trade atinge o pico de 4.2x em aportes entre R$ 50k e R$ 85k mensais.
          </p>
        </div>
      </div>
    </div>
  );
};
