"use client";

import React from "react";
import { Users, AlertTriangle, TrendingUp, Award, DollarSign } from "lucide-react";
import { CrmResumoCarteira } from "@/lib/governance/analytics/engine";

interface CrmResumoExecutivoProps {
  resumo: CrmResumoCarteira;
  totalOportunidades: number;
  loading?: boolean;
}

export const CrmResumoExecutivo: React.FC<CrmResumoExecutivoProps> = ({
  resumo,
  totalOportunidades,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total da Carteira & Saúde */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Total da Carteira & Saúde</span>
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
                {resumo.totalClientesCarteira}
              </h2>
              <span className="text-xs font-bold text-emerald-500 font-mono">
                ({resumo.scoreSaudeGlobal}/100 Saúde)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Clientes Ativos: {resumo.totalClientesAtivos}
          </p>
        </div>
      </div>

      {/* Card 2: Clientes em Risco & Inativos */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Clientes em Risco / Inativos</span>
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-bold text-rose-500 font-mono tracking-tight">
                {resumo.totalClientesEmRisco + resumo.totalClientesInativos}
              </h2>
              <span className="text-xs text-muted-foreground font-mono">
                ({resumo.totalClientesCarteira > 0 ? (((resumo.totalClientesEmRisco + resumo.totalClientesInativos) / resumo.totalClientesCarteira) * 100).toFixed(1) : 0}%)
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Em Risco: {resumo.totalClientesEmRisco} | Inativos: {resumo.totalClientesInativos}
          </p>
        </div>
      </div>

      {/* Card 3: Potencial Financeiro de Recuperação */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Potencial de Recuperação MACO</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-emerald-500 font-mono tracking-tight">
              {formatCur(resumo.potencialRecuperacaoMaco)}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Ganho financeiro acumulado estimado
          </p>
        </div>
      </div>

      {/* Card 4: Oportunidades Prioritárias */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm relative overflow-hidden group hover:border-gold/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Ações Prescritivas Emitidas</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg" />
          ) : (
            <h2 className="text-2xl font-bold text-foreground font-mono tracking-tight">
              {totalOportunidades}
            </h2>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            Priorizadas pelo Score Comercial (0-100)
          </p>
        </div>
      </div>
    </div>
  );
};
