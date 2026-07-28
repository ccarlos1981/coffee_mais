"use client";

import React from "react";
import { PieChart, CheckCircle2, AlertTriangle } from "lucide-react";
import { CoverageAuditItem } from "@/lib/governance/data-quality";

interface CoveragePanelProps {
  coverage: CoverageAuditItem[];
}

export const CoveragePanel: React.FC<CoveragePanelProps> = ({ coverage }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
          <PieChart className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Cobertura de Cadastros & Dimensões Negociais</h3>
          <p className="text-[11px] text-muted-foreground">
            Avaliação de integridade em territórios, gerentes, categorias e redes (Frente 9)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {coverage.map((item, idx) => (
          <div key={idx} className="p-3.5 bg-background border border-border rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground font-sans">{item.dimension}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  item.status === "COMPLETE"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : item.status === "PARTIAL"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {item.status}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Preenchimento:</span>
              <span className="font-bold text-teal-500">{item.coveredItems} / {item.totalItems} ({item.coveragePct}%)</span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-500 h-1.5 rounded-full transition-all"
                style={{ width: `${item.coveragePct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
