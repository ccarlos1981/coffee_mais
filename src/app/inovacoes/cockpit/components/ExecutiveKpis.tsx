"use client";

import React from "react";
import { DollarSign, TrendingUp, TrendingDown, Users, AlertTriangle, UserX, Receipt } from "lucide-react";
import { CockpitComercialData } from "@/lib/governance/analytics/engine";

interface ExecutiveKpisProps {
  metrics: CockpitComercialData["metrics"];
  loading?: boolean;
}

export const ExecutiveKpis: React.FC<ExecutiveKpisProps> = ({ metrics, loading = false }) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const isPositiveGrowth = metrics.crescimentoPercentual >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Faturamento Atual */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Faturamento Realizado</span>
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(metrics.faturamentoAtual)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Faturamento líquido consolidado do período
          </p>
        </div>
      </div>

      {/* Card 2: Comparativo Período Anterior */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">vs Período Anterior</span>
          <div
            className={`p-2 rounded-xl ${
              isPositiveGrowth
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-rose-500/10 text-rose-500"
            }`}
          >
            {isPositiveGrowth ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2
                className={`text-2xl font-bold font-mono tracking-tight ${
                  isPositiveGrowth ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isPositiveGrowth ? "+" : ""}
                {metrics.crescimentoPercentual.toFixed(1)}%
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                ({formatCur(metrics.crescimentoNominal)})
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Anterior: {formatCur(metrics.faturamentoAnterior)}
          </p>
        </div>
      </div>

      {/* Card 3: Saúde de Clientes (Ativos / Atenção / Inativos) */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Saúde da Carteira</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xl font-bold text-emerald-500 font-mono">
                  {metrics.clientesAtivos}
                </span>
                <span className="text-[10px] block text-muted-foreground font-medium">Ativos</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-xl font-bold text-amber-500 font-mono">
                  {metrics.clientesAtencao}
                </span>
                <span className="text-[10px] block text-muted-foreground font-medium">Atenção</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-xl font-bold text-rose-500 font-mono">
                  {metrics.clientesInativos}
                </span>
                <span className="text-[10px] block text-muted-foreground font-medium">Inativos</span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Distribuição por recência de compra
          </p>
        </div>
      </div>

      {/* Card 4: Ticket Médio por Cliente */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Ticket Médio / Cliente</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
            <Receipt className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {formatCur(metrics.ticketMedio)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Faturamento médio por cliente comprador
          </p>
        </div>
      </div>
    </div>
  );
};
