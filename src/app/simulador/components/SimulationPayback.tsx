"use client";

import React from "react";
import { Clock } from "lucide-react";
import { SimulationImpact } from "@/lib/governance/analytics/simulation";

interface SimulationPaybackProps {
  impacto: SimulationImpact;
  loading?: boolean;
}

export const SimulationPayback: React.FC<SimulationPaybackProps> = ({
  impacto,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Tempo de Retorno (Payback)</h3>
            <p className="text-[11px] text-muted-foreground">Período para recuperação do investimento</p>
          </div>
        </div>

        <span className="text-2xl font-black font-mono text-gold bg-gold/10 px-4 py-1 rounded-2xl border border-gold/20">
          {impacto.paybackMeses} Meses
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        O investimento adicional será 100% amortizado em <strong>{impacto.paybackMeses} meses</strong> decorridos a partir da execução do plano.
      </p>
    </div>
  );
};
