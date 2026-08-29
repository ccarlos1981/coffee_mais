'use client';

import React from 'react';
import { ClosingChannelRow } from '@/lib/services/monthly-closing-engine';
import { Layers } from 'lucide-react';

interface ClosingCanaisGridProps {
  canais: ClosingChannelRow[];
  totalFaturamento: number;
  isLoading: boolean;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const ClosingCanaisGrid: React.FC<ClosingCanaisGridProps> = ({
  canais,
  totalFaturamento,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl animate-pulse" aria-busy="true" aria-label="Carregando tabela de canais">
        <div className="h-6 bg-slate-800 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Ordenar canais pelo faturamento decrescente
  const sortedCanais = [...canais].sort((a, b) => b.realFaturamento - a.realFaturamento);

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            Distribuição por Canal de Venda
          </h2>
          <p className="text-xs text-slate-400">
            Faturamento líquido consolidado e participação percentual por canal comercial
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse" role="table" aria-label="Tabela de canais de venda">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
              <th className="py-3 px-4 rounded-l-xl">Canal</th>
              <th className="py-3 px-4 text-right">Real Faturado</th>
              <th className="py-3 px-4 text-center">Share (%)</th>
              <th className="py-3 px-4 text-right rounded-r-xl">Distribuição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {sortedCanais.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                  Nenhum canal identificado para esta competência.
                </td>
              </tr>
            ) : (
              sortedCanais.map((c) => {
                const sharePct = totalFaturamento > 0 ? (c.realFaturamento / totalFaturamento) * 100 : 0;

                return (
                  <tr key={c.channel} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {c.channel}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                      {formatCurrency(c.realFaturamento)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-300">
                      {sharePct.toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4 text-right w-1/3">
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
