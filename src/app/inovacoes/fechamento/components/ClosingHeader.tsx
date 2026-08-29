'use client';

import React from 'react';
import { Calendar, Presentation, Download, RefreshCw, ShieldCheck, AlertCircle } from 'lucide-react';

interface ClosingHeaderProps {
  year: number;
  month: number;
  onChangeCompetencia: (year: number, month: number) => void;
  onOpenPresentation: () => void;
  onExportPptx: () => void;
  onRefresh: () => void;
  isExporting: boolean;
  isLoading: boolean;
  statusMaco: 'DISPONIVEL' | 'DADOS_INDISPONIVEIS';
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ClosingHeader: React.FC<ClosingHeaderProps> = ({
  year,
  month,
  onChangeCompetencia,
  onOpenPresentation,
  onExportPptx,
  onRefresh,
  isExporting,
  isLoading,
  statusMaco,
}) => {
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 3 + i);

  return (
    <header className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl" role="banner">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Título e Identidade */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Wave B.11 • Fechamento Mensal
            </span>
            {statusMaco === 'DISPONIVEL' ? (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                MACO Homologado (Baseline 57)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                MACO Sob Apuração
              </span>
            )}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-100 tracking-tight">
            Cockpit de Fechamento Executivo & RDM 360°
          </h1>
          <p className="text-sm text-slate-400">
            Consolidação unificada de Meta, Projeção Semanal (RPS), Real Faturado e Margem de Contribuição
          </p>
        </div>

        {/* Controles de Período e Ações */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Mês/Ano */}
          <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-xl p-1 shadow-inner">
            <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" aria-hidden="true" />
            <select
              aria-label="Selecionar mês"
              value={month}
              disabled={isLoading}
              onChange={(e) => onChangeCompetencia(year, parseInt(e.target.value, 10))}
              className="bg-transparent text-slate-200 text-sm font-medium py-1 px-2 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1} className="bg-slate-900 text-slate-200">
                  {name}
                </option>
              ))}
            </select>
            <span className="text-slate-600">/</span>
            <select
              aria-label="Selecionar ano"
              value={year}
              disabled={isLoading}
              onChange={(e) => onChangeCompetencia(parseInt(e.target.value, 10), month)}
              className="bg-transparent text-slate-200 text-sm font-medium py-1 px-2 focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-slate-200">
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Atualizar */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Atualizar dados de fechamento"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Botão Modo Apresentação (RDM 360) */}
          <button
            onClick={onOpenPresentation}
            disabled={isLoading}
            aria-label="Abrir modo apresentação RDM 360"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <Presentation className="w-4 h-4" />
            <span>Apresentação RDM 360°</span>
          </button>

          {/* Botão Exportar PPTX */}
          <button
            onClick={onExportPptx}
            disabled={isLoading || isExporting}
            aria-label="Exportar apresentação PowerPoint 16:9"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700/80 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce text-amber-400' : ''}`} />
            <span>{isExporting ? 'Gerando PPTX...' : 'Exportar PPTX 16:9'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
