"use client";

import React from "react";
import { DollarSign, Percent, PieChart, ShieldCheck, Truck, Award } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";

interface DreResumoExecutivoProps {
  totais: DreComercialData["totais"];
  loading?: boolean;
}

export const DreResumoExecutivo: React.FC<DreResumoExecutivoProps> = ({ totais, loading = false }) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const isMacoPositive = totais.macoTotal >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Receita Comercial Líquida */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Receita Comercial Líquida</span>
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(totais.faturamentoLiquido)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Bruto: {formatCur(totais.faturamentoBruto)}
          </p>
        </div>
      </div>

      {/* Card 2: Margem Bruta */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Margem Bruta (pós-CPV)</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
                {formatCur(totais.margemBruta)}
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                ({totais.faturamentoLiquido > 0 ? ((totais.margemBruta / totais.faturamentoLiquido) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            CPV: {formatCur(totais.cpv)}
          </p>
        </div>
      </div>

      {/* Card 3: Custo Logístico (Frete 3%) & Trade */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Frete (3%) & Investimentos</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(totais.frete + totais.investimentoComercial)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Frete: {formatCur(totais.frete)} | Trade: {formatCur(totais.investimentoComercial)}
          </p>
        </div>
      </div>

      {/* Card 4: MARGEM DE CONTRIBUIÇÃO (MACO) */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Margem de Contribuição (MACO)</span>
          <div
            className={`p-2 rounded-xl ${
              isMacoPositive
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-rose-500/10 text-rose-500"
            }`}
          >
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2
                className={`text-2xl font-bold font-mono tracking-tight ${
                  isMacoPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {formatCur(totais.macoTotal)}
              </h2>
              <span
                className={`text-xs font-mono font-bold ${
                  isMacoPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                ({totais.margemMacoMedia.toFixed(1)}%)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Resultado final da operação comercial
          </p>
        </div>
      </div>
    </div>
  );
};
