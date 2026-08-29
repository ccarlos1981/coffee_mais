'use client';

import React from 'react';
import { DollarSign, Target, TrendingUp, PieChart, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { ClosingKpiSummary } from '@/lib/services/monthly-closing-engine';

interface ClosingKpiCardsProps {
  summary?: ClosingKpiSummary;
  isLoading: boolean;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatVolume = (val: number) => {
  const tons = (val || 0) / 1000;
  return `${tons.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ton`;
};

export const ClosingKpiCards: React.FC<ClosingKpiCardsProps> = ({ summary, isLoading }) => {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" aria-busy="true" aria-label="Carregando indicadores principais">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/3 mb-3" />
            <div className="h-8 bg-slate-800 rounded w-2/3 mb-2" />
            <div className="h-4 bg-slate-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const {
    realFaturamento,
    realVolumeKg,
    metaFaturamento,
    metaVolumeKg,
    rpsFaturamento,
    rpsVolumeKg,
    atingimentoMetaPct,
    atingimentoRpsPct,
    desvioMeta,
    desvioRps,
    macoReal,
    macoRealPct,
    statusMaco,
  } = summary;

  // Status visual semafórico para Atingimento de Meta
  const isMetaSuperada = atingimentoMetaPct >= 100;
  const isMetaAtencao = atingimentoMetaPct >= 90 && atingimentoMetaPct < 100;
  const metaBadgeClass = metaFaturamento <= 0
    ? 'bg-slate-800 text-slate-400 border-slate-700'
    : isMetaSuperada
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : isMetaAtencao
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <section aria-label="Indicadores consolidados de fechamento" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Faturamento Real */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors" />
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Real</span>
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100 tracking-tight mb-1">
          {formatCurrency(realFaturamento)}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Volume Real:</span>
          <span className="font-semibold text-slate-200">{formatVolume(realVolumeKg)}</span>
        </div>
      </div>

      {/* Card 2: Meta Comercial & Atingimento */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Meta Comercial</span>
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100 tracking-tight mb-1">
          {formatCurrency(metaFaturamento)}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Atingimento:</span>
          <span className={`px-2 py-0.5 rounded-full font-bold border ${metaBadgeClass}`}>
            {metaFaturamento > 0 ? `${atingimentoMetaPct.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="mt-2 text-xs flex items-center justify-between text-slate-400 border-t border-slate-800/60 pt-1.5">
          <span>Gap vs Meta:</span>
          <span className={`font-semibold flex items-center gap-0.5 ${desvioMeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {desvioMeta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatCurrency(desvioMeta)}
          </span>
        </div>
      </div>

      {/* Card 3: Projeção RPS & Dispersão */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Projeção RPS</span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100 tracking-tight mb-1">
          {formatCurrency(rpsFaturamento)}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Dispersão Real vs RPS:</span>
          <span className="font-semibold text-purple-300">
            {rpsFaturamento > 0 ? `${atingimentoRpsPct.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className="mt-2 text-xs flex items-center justify-between text-slate-400 border-t border-slate-800/60 pt-1.5">
          <span>Delta RPS:</span>
          <span className={`font-semibold flex items-center gap-0.5 ${desvioRps >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {desvioRps >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {formatCurrency(desvioRps)}
          </span>
        </div>
      </div>

      {/* Card 4: Rentabilidade MACO (Baseline 57) */}
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rentabilidade MACO</span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <PieChart className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold text-slate-100 tracking-tight mb-1">
          {statusMaco === 'DISPONIVEL' ? formatCurrency(macoReal) : '—'}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Margem MACO Real:</span>
          <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {statusMaco === 'DISPONIVEL' ? `${macoRealPct.toFixed(1)}%` : 'Sob Apuração'}
          </span>
        </div>
        <div className="mt-2 text-xs flex items-center justify-between text-slate-400 border-t border-slate-800/60 pt-1.5">
          <span>Status Financeiro:</span>
          <span className="font-semibold text-slate-300">
            {statusMaco === 'DISPONIVEL' ? 'Oficial Homologado' : 'Indisponível'}
          </span>
        </div>
      </div>
    </section>
  );
};
