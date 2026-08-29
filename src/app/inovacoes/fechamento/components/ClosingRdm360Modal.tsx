'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MonthlyClosingDTO } from '@/lib/services/monthly-closing-engine';
import { X, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2, Presentation, ShieldCheck, DollarSign, Target, TrendingUp, PieChart, Layers } from 'lucide-react';
import { exportClosingToPptx } from '../utils/exportPptx';
import { toast } from 'sonner';

interface ClosingRdm360ModalProps {
  data: MonthlyClosingDTO;
  isOpen: boolean;
  onClose: () => void;
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

export const ClosingRdm360Modal: React.FC<ClosingRdm360ModalProps> = ({ data, isOpen, onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const slideRef = useRef<HTMLDivElement>(null);
  const totalSlides = 4;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !data) return null;

  const { resumoNacional, gerentes, canais, competencia, year, month } = data;

  const handleExport = async () => {
    if (!slideRef.current) return;
    try {
      setIsExporting(true);
      const originalSlide = currentSlide;

      // Montar array de slides virtuais ou renderizar sequencialmente
      toast.info('Iniciando geração dos slides PowerPoint 16:9...');

      // Capturar o slide ativo atual
      const success = await exportClosingToPptx({
        slides: [
          { id: 'slide-1', title: 'Visão Executiva', element: slideRef.current },
        ],
        year,
        month,
      });

      if (success) {
        toast.success('Apresentação PPTX gerada com sucesso!');
      } else {
        toast.error('Exportação cancelada ou incompleta.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar apresentação.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderSlideContent = () => {
    switch (currentSlide) {
      case 0:
        // SLIDE 1: Visão Executiva Nacional
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Coffee++ • RDM 360°</span>
                <h3 className="text-2xl font-bold text-slate-100">Fechamento Executivo Nacional — {competencia}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
                Dados Oficiais Homologados
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 my-6">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 shadow-inner">
                <span className="text-xs text-slate-400 uppercase font-semibold">Real Faturado (Receita Líquida)</span>
                <div className="text-4xl font-extrabold text-slate-100 mt-2">{formatCurrency(resumoNacional.realFaturamento)}</div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400 border-t border-slate-800 pt-3">
                  <span>Volume Real:</span>
                  <span className="font-bold text-slate-200">{formatVolume(resumoNacional.realVolumeKg)}</span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 shadow-inner">
                <span className="text-xs text-slate-400 uppercase font-semibold">Meta Comercial & Atingimento</span>
                <div className="text-4xl font-extrabold text-blue-400 mt-2">{formatCurrency(resumoNacional.metaFaturamento)}</div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400 border-t border-slate-800 pt-3">
                  <span>% Atingimento:</span>
                  <span className="font-bold text-amber-400">{resumoNacional.atingimentoMetaPct.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 shadow-inner">
                <span className="text-xs text-slate-400 uppercase font-semibold">Projeção Semanal (RPS)</span>
                <div className="text-4xl font-extrabold text-purple-400 mt-2">{formatCurrency(resumoNacional.rpsFaturamento)}</div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400 border-t border-slate-800 pt-3">
                  <span>Dispersão Real vs RPS:</span>
                  <span className="font-bold text-purple-300">{resumoNacional.atingimentoRpsPct.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 shadow-inner">
                <span className="text-xs text-slate-400 uppercase font-semibold">Rentabilidade MACO (Baseline 57)</span>
                <div className="text-4xl font-extrabold text-emerald-400 mt-2">
                  {resumoNacional.statusMaco === 'DISPONIVEL' ? formatCurrency(resumoNacional.macoReal) : 'Sob Apuração'}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-400 border-t border-slate-800 pt-3">
                  <span>Margem MACO:</span>
                  <span className="font-bold text-emerald-400">
                    {resumoNacional.statusMaco === 'DISPONIVEL' ? `${resumoNacional.macoRealPct.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-3">
              <span>Deck Executivo de Fechamento • Slide 1 de {totalSlides}</span>
              <span>Gerado em: {new Date(data.timestamp).toLocaleString('pt-BR')}</span>
            </div>
          </div>
        );

      case 1:
        // SLIDE 2: Performance Regional
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Coffee++ • RDM 360°</span>
                <h3 className="text-2xl font-bold text-slate-100">Performance por Gerente Regional — {competencia}</h3>
              </div>
              <span className="text-xs text-slate-400">Ordenado por faturamento</span>
            </div>

            <div className="my-4 overflow-y-auto max-h-[380px]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 font-semibold">
                    <th className="py-2 px-3">Regional</th>
                    <th className="py-2 px-3 text-right">Meta (R$)</th>
                    <th className="py-2 px-3 text-right">Real (R$)</th>
                    <th className="py-2 px-3 text-center">% Atingimento</th>
                    <th className="py-2 px-3 text-right">Desvio (R$)</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {gerentes.map((g) => (
                    <tr key={g.managerId}>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{g.managerName}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{g.metaFaturamento > 0 ? formatCurrency(g.metaFaturamento) : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-100">{formatCurrency(g.realFaturamento)}</td>
                      <td className="py-2.5 px-3 text-center font-semibold text-amber-400">{g.metaFaturamento > 0 ? `${g.atingimentoMetaPct.toFixed(1)}%` : '—'}</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${g.desvioMeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(g.desvioMeta)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          g.status === 'SUPERADA' ? 'bg-emerald-500/10 text-emerald-400' :
                          g.status === 'ATENCAO' ? 'bg-amber-500/10 text-amber-400' :
                          g.status === 'CRITICA' ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-3">
              <span>Deck Executivo de Fechamento • Slide 2 de {totalSlides}</span>
              <span>Fonte: AnalyticsEngine V1</span>
            </div>
          </div>
        );

      case 2:
        // SLIDE 3: Diagnóstico MACO
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Coffee++ • RDM 360°</span>
                <h3 className="text-2xl font-bold text-slate-100">Diagnóstico de Rentabilidade MACO — Baseline 57</h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Margem Média Nacional</span>
                <div className="text-xl font-bold text-emerald-400">{resumoNacional.macoRealPct.toFixed(1)}%</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 my-6">
              {gerentes.map((g) => (
                <div key={g.managerId} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 shadow-inner">
                  <div className="text-sm font-semibold text-slate-200 mb-1">{g.managerName}</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {g.macoValor !== 0 ? formatCurrency(g.macoValor) : '—'}
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2">
                    <span>% Margem:</span>
                    <span className="font-bold text-emerald-300">{g.macoPct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-3">
              <span>Deck Executivo de Fechamento • Slide 3 de {totalSlides}</span>
              <span>Fórmula: Receita Líquida - Impostos - CPV - Frete (3%) - Investimento</span>
            </div>
          </div>
        );

      case 3:
        // SLIDE 4: Performance por Canal & Gaps
        return (
          <div className="h-full flex flex-col justify-between p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Coffee++ • RDM 360°</span>
                <h3 className="text-2xl font-bold text-slate-100">Distribuição por Canal de Venda — {competencia}</h3>
              </div>
              <span className="text-xs text-slate-400">Consolidado Nacional</span>
            </div>

            <div className="grid grid-cols-2 gap-4 my-6">
              {canais.map((c) => {
                const sharePct = resumoNacional.realFaturamento > 0 ? (c.realFaturamento / resumoNacional.realFaturamento) * 100 : 0;
                return (
                  <div key={c.channel} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold text-slate-200">{c.channel}</span>
                      <span className="text-xs font-bold text-purple-400">{sharePct.toFixed(1)}% Share</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-100">{formatCurrency(c.realFaturamento)}</div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                      <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${sharePct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-500 flex justify-between border-t border-slate-800 pt-3">
              <span>Deck Executivo de Fechamento • Slide 4 de {totalSlides}</span>
              <span>Encaminhamentos Comerciais & Planos de Ação</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação RDM 360"
    >
      <div className={`bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[620px]'
      }`}>
        {/* Barra Superior de Controles */}
        <div className="bg-slate-950/80 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Presentation className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-slate-200">Apresentação RDM 360° — Deck Executivo</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão Exportar Slide */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Exportar slide ativo para PPTX"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exportando...' : 'Exportar Slide'}</span>
            </button>

            {/* Alternar Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Fechar Modal */}
            <button
              onClick={onClose}
              aria-label="Fechar apresentação"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Área de Visualização do Slide 16:9 */}
        <div className="flex-1 bg-slate-900 overflow-hidden flex items-center justify-center p-4">
          <div
            ref={slideRef}
            className="w-full h-full max-w-4xl max-h-[500px] bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-2xl aspect-[16/9]"
          >
            {renderSlideContent()}
          </div>
        </div>

        {/* Barra Inferior de Navegação */}
        <div className="bg-slate-950/80 px-6 py-3 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentSlide === i ? 'bg-amber-400 w-6' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              aria-label="Slide anterior"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">
              Slide {currentSlide + 1} de {totalSlides}
            </span>
            <button
              onClick={() => setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1))}
              disabled={currentSlide === totalSlides - 1}
              aria-label="Próximo slide"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
