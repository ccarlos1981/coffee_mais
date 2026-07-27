"use client";

import React from "react";
import { FileText, Calculator, ChevronRight } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";

interface DreSinteticaCardProps {
  sintetica: DreComercialData["sintetica"];
  loading?: boolean;
}

export const DreSinteticaCard: React.FC<DreSinteticaCardProps> = ({ sintetica, loading = false }) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const getRowStyle = (tipo: string) => {
    switch (tipo) {
      case "RESULTADO":
        return "bg-gold/10 border-gold/30 font-extrabold text-foreground text-sm";
      case "SUBTOTAL":
        return "bg-muted/40 font-bold text-foreground";
      case "RECEITA":
        return "font-semibold text-foreground";
      default:
        return "text-muted-foreground hover:text-foreground";
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Demonstração Sintética do Resultado (Cascata DRE)</h3>
            <p className="text-[11px] text-muted-foreground">
              Decomposição da Receita Bruta até a Margem de Contribuição (MACO)
            </p>
          </div>
        </div>
      </div>

      {/* Lista em Cascata */}
      <div className="overflow-hidden rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Calculando estrutura da DRE Comercial...
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sintetica.map((item, idx) => (
              <div
                key={`${item.label}-${idx}`}
                className={`p-3.5 flex items-center justify-between transition-colors ${getRowStyle(
                  item.tipo
                )}`}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight className="w-3.5 h-3.5 text-gold opacity-75" />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-6 font-mono">
                  <span className="text-right w-32">{formatCur(item.valor)}</span>
                  <span className="text-right w-16 text-xs text-muted-foreground">
                    {item.percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
