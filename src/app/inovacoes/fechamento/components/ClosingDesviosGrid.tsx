'use client';

import React, { useState } from 'react';
import { ClosingManagerRow } from '@/lib/services/monthly-closing-engine';
import { ShieldAlert, ArrowUpRight, ArrowDownRight, PlusCircle, CheckCircle2, User, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ClosingDesviosGridProps {
  gerentes: ClosingManagerRow[];
  competencia: string;
  isLoading: boolean;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export const ClosingDesviosGrid: React.FC<ClosingDesviosGridProps> = ({
  gerentes,
  competencia,
  isLoading,
}) => {
  const [loadingActionManagerId, setLoadingActionManagerId] = useState<string | null>(null);
  const [createdActions, setCreatedActions] = useState<Set<string>>(new Set());

  const handleCreateFollowUp = async (gerente: ClosingManagerRow) => {
    try {
      setLoadingActionManagerId(gerente.managerId);
      const origemRef = `FECHAMENTO_${gerente.managerId}_${competencia}_PLANO_RECUPERACAO`;

      const response = await fetch('/api/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: `REGIONAL_${gerente.managerId}`,
          manager_id: gerente.managerId,
          origem: 'COCKPIT_PRESCRITIVO',
          origem_ref: origemRef,
          tipo_acao: 'RECUPERACAO_VOLUME',
          prioridade: 'ALTA',
          motivo: `Gap de fechamento em ${competencia}: Faturado ${formatCurrency(gerente.realFaturamento)} vs Meta ${formatCurrency(gerente.metaFaturamento)} (${gerente.atingimentoMetaPct}%).`,
          descricao: `Plano de recuperação comercial gerado a partir do Cockpit de Fechamento Executivo para a regional ${gerente.managerName}.`,
          prazo: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          gap_original_reais: Math.abs(gerente.desvioMeta),
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha ao criar plano de ação.');
      }

      setCreatedActions((prev) => new Set(prev).add(gerente.managerId));
      toast.success(`Plano de ação de recuperação criado para ${gerente.managerName}!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar follow-up.');
    } finally {
      setLoadingActionManagerId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl animate-pulse" aria-busy="true" aria-label="Carregando tabela de gerentes">
        <div className="h-6 bg-slate-800 rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/60 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-6 mb-6 shadow-xl overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            Performance Regional & Diagnóstico de Fechamento
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhamento de Real vs Meta, Dispersão RPS e Rentabilidade MACO por Gerente
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse" role="table" aria-label="Tabela de desempenho dos gerentes">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-950/40">
              <th className="py-3 px-4 rounded-l-xl">Gerente Regional</th>
              <th className="py-3 px-4 text-right">Meta (R$)</th>
              <th className="py-3 px-4 text-right">Projeção RPS</th>
              <th className="py-3 px-4 text-right">Real Faturado</th>
              <th className="py-3 px-4 text-center">% Atingimento</th>
              <th className="py-3 px-4 text-right">Desvio vs Meta</th>
              <th className="py-3 px-4 text-right">MACO (R$)</th>
              <th className="py-3 px-4 text-center">Farol</th>
              <th className="py-3 px-4 text-center rounded-r-xl">Ação Corretiva</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {gerentes.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                  Nenhum dado gerencial encontrado para esta competência.
                </td>
              </tr>
            ) : (
              gerentes.map((g) => {
                const isCreated = createdActions.has(g.managerId);
                const isActionLoading = loadingActionManagerId === g.managerId;

                // Estilização semafórica baseada no status oficial do DTO
                let statusBadge = (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    SEM META
                  </span>
                );

                if (g.status === 'SUPERADA') {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      SUPERADA
                    </span>
                  );
                } else if (g.status === 'ATENCAO') {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      ATENÇÃO
                    </span>
                  );
                } else if (g.status === 'CRITICA') {
                  statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      CRÍTICA
                    </span>
                  );
                }

                return (
                  <tr key={g.managerId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {g.managerName}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      {g.metaFaturamento > 0 ? formatCurrency(g.metaFaturamento) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-purple-300">
                      {g.rpsFaturamento > 0 ? formatCurrency(g.rpsFaturamento) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                      {formatCurrency(g.realFaturamento)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold">
                      {g.metaFaturamento > 0 ? `${g.atingimentoMetaPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium">
                      <span className={`inline-flex items-center gap-0.5 ${g.desvioMeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {g.desvioMeta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        {formatCurrency(g.desvioMeta)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-medium">
                      {g.macoValor !== 0 ? (
                        <span>
                          {formatCurrency(g.macoValor)} <span className="text-xs text-emerald-500/80">({g.macoPct.toFixed(1)}%)</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {statusBadge}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {g.status === 'CRITICA' ? (
                        isCreated ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Plano Ativo
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCreateFollowUp(g)}
                            disabled={isActionLoading}
                            aria-label={`Criar plano de recuperação para ${g.managerName}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-rose-400"
                          >
                            <PlusCircle className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                            <span>{isActionLoading ? 'Criando...' : 'Plano de Ação'}</span>
                          </button>
                        )
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
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
