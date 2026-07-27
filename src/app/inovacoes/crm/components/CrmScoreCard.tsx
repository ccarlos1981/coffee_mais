"use client";

import React from "react";
import { UserCheck, ShieldCheck, AlertCircle } from "lucide-react";
import { CrmComercialData } from "@/lib/governance/analytics/engine";

interface CrmScoreCardProps {
  rankingGerentesScore: CrmComercialData["rankingGerentesScore"];
  loading?: boolean;
}

export const CrmScoreCard: React.FC<CrmScoreCardProps> = ({
  rankingGerentesScore,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Score de Saúde da Carteira por Gerente</h3>
            <p className="text-[11px] text-muted-foreground">
              Pontuação de 0 a 100 baseada na proporção de clientes ativos e rentabilidade de MACO
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Calculando Score de Saúde da Carteira por Gerente...
        </div>
      ) : rankingGerentesScore.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhum gerente registrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {rankingGerentesScore.map((item, idx) => {
            const isGoodScore = item.scoreSaude >= 70;
            return (
              <div
                key={`${item.gerente}-${idx}`}
                className="bg-background border border-border rounded-xl p-3.5 space-y-2 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground truncate max-w-[140px]" title={item.gerente}>
                    {item.gerente}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isGoodScore
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-rose-500/10 text-rose-500"
                    }`}
                  >
                    {item.scoreSaude}/100
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-muted-foreground font-mono">
                  <div className="flex justify-between">
                    <span>Clientes:</span>
                    <span className="text-foreground">{item.totalClientes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MACO Médio:</span>
                    <span className="text-foreground">{item.macoMedioPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ações Críticas:</span>
                    <span className={item.oportunidadesPrioritarias > 0 ? "text-rose-500 font-bold" : "text-emerald-500"}>
                      {item.oportunidadesPrioritarias}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
