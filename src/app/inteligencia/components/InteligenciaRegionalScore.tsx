"use client";

import React from "react";
import { Globe, MapPin, Award } from "lucide-react";
import { IntelligenceRegionalPerf } from "@/lib/governance/analytics/intelligence";

interface InteligenciaRegionalScoreProps {
  desempenhoRegional: IntelligenceRegionalPerf[];
  loading?: boolean;
}

export const InteligenciaRegionalScore: React.FC<InteligenciaRegionalScoreProps> = ({
  desempenhoRegional,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Desempenho & Eficiência Comercial por Região</h3>
            <p className="text-[11px] text-muted-foreground">
              Consolidação analítica de faturamento, margem MACO e score de eficiência por território
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Apurando eficiência comercial por território...
          </div>
        ) : desempenhoRegional.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum dado regional apurado.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Território / Região</th>
                <th className="py-2.5 px-3 text-center">Clientes</th>
                <th className="py-2.5 px-3 text-right">Faturamento Bruto</th>
                <th className="py-2.5 px-3 text-right">Faturamento Líquido</th>
                <th className="py-2.5 px-3 text-right">MACO Total</th>
                <th className="py-2.5 px-3 text-center">Margem MACO (%)</th>
                <th className="py-2.5 px-3 text-center">Score Eficiência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {desempenhoRegional.map((row, idx) => (
                <tr key={`${row.regiaoOuUf}-${idx}`} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-sans font-bold text-foreground truncate max-w-[200px]">
                    {row.regiaoOuUf}
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">{row.totalClientes}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-foreground">
                    {formatCur(row.faturamentoBruto)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground">
                    {formatCur(row.faturamentoLiquido)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-emerald-500">
                    {formatCur(row.macoTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-foreground">
                    {row.margemMacoMedia.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-block bg-gold/10 text-gold px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-gold/20">
                      {row.scoreEficiencia}/100
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
