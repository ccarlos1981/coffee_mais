'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MonthlyClosingDTO } from '@/lib/services/monthly-closing-engine';
import { ClosingHeader } from './components/ClosingHeader';
import { ClosingKpiCards } from './components/ClosingKpiCards';
import { ClosingDesviosGrid } from './components/ClosingDesviosGrid';
import { ClosingCanaisGrid } from './components/ClosingCanaisGrid';
import { ClosingRdm360Modal } from './components/ClosingRdm360Modal';
import { exportClosingToPptx } from './utils/exportPptx';
import { AlertTriangle, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function FechamentoExecutivoPage() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [data, setData] = useState<MonthlyClosingDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);

  const [isPresentationOpen, setIsPresentationOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchClosingData = useCallback(async (selectedYear: number, selectedMonth: number) => {
    try {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      const res = await fetch(`/api/inovacoes/fechamento?year=${selectedYear}&month=${selectedMonth}`);
      const json = await res.json();

      if (!res.ok) {
        setErrorCode(res.status);
        throw new Error(json.error || 'Erro ao carregar dados de fechamento.');
      }

      if (!json.success || !json.data) {
        throw new Error(json.error || 'Payload de fechamento inválido.');
      }

      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Falha na comunicação com o servidor.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClosingData(year, month);
  }, [year, month, fetchClosingData]);

  const handleChangeCompetencia = (newYear: number, newMonth: number) => {
    setYear(newYear);
    setMonth(newMonth);
  };

  const handleExportFullPptx = async () => {
    if (!data) return;
    try {
      setIsExporting(true);
      toast.info('Preparando exportação de slides executivos...');
      // Abre o modal de apresentação para garantir que os elementos DOM de slide existam e exporta
      setIsPresentationOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar apresentação.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header de Controle */}
        <ClosingHeader
          year={year}
          month={month}
          onChangeCompetencia={handleChangeCompetencia}
          onOpenPresentation={() => setIsPresentationOpen(true)}
          onExportPptx={handleExportFullPptx}
          onRefresh={() => fetchClosingData(year, month)}
          isExporting={isExporting}
          isLoading={isLoading}
          statusMaco={data?.resumoNacional.statusMaco || 'DADOS_INDISPONIVEIS'}
        />

        {/* Estado de Erro / 403 Forbidden */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 mb-6 shadow-xl flex items-start gap-4">
            {errorCode === 403 ? (
              <Lock className="w-6 h-6 text-rose-400 mt-1 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-rose-400 mt-1 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h2 className="text-base font-bold text-rose-200">
                {errorCode === 403 ? 'Acesso Restrito (403 Forbidden)' : 'Erro ao Carregar Fechamento'}
              </h2>
              <p className="text-sm text-rose-300/80 mt-1">{error}</p>
              {errorCode !== 403 && (
                <button
                  onClick={() => fetchClosingData(year, month)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-800/60 hover:bg-rose-700/60 text-rose-100 text-xs font-semibold border border-rose-700/60 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tentar Novamente</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Cards de KPIs Principais */}
        <ClosingKpiCards
          summary={data?.resumoNacional}
          isLoading={isLoading}
        />

        {/* Grid de Desvios por Gerente & Farol */}
        <ClosingDesviosGrid
          gerentes={data?.gerentes || []}
          competencia={data?.competencia || `${year}-${String(month).padStart(2, '0')}`}
          isLoading={isLoading}
        />

        {/* Grid de Canais de Venda */}
        <ClosingCanaisGrid
          canais={data?.canais || []}
          totalFaturamento={data?.resumoNacional.realFaturamento || 0}
          isLoading={isLoading}
        />

        {/* Modal de Apresentação RDM 360 */}
        {data && (
          <ClosingRdm360Modal
            data={data}
            isOpen={isPresentationOpen}
            onClose={() => setIsPresentationOpen(false)}
          />
        )}
      </div>
    </main>
  );
}
