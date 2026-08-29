"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Building2,
  User,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  Flame,
  Plus,
  Loader2,
  Clock,
  Layers,
} from "lucide-react";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";
import type { FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";

export interface RpsRedeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  redeName: string;
  codigoMatriz?: string | null;
  uf?: string | null;
  managerName: string;
  year: number;
  month: number;
  curReal: number;
  curMeta: number;
  projections: number[];
  mondays: string[];
  onOpenFollowUp?: (context: FollowUpInitialContext) => void;
}

const formatCurrency = (val: number | null | undefined) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export function RpsRedeDrawer({
  isOpen,
  onClose,
  redeName,
  codigoMatriz,
  uf,
  managerName,
  year,
  month,
  curReal,
  curMeta,
  projections,
  mondays,
  onOpenFollowUp,
}: RpsRedeDrawerProps) {
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  const isOutros = redeName.trim().toUpperCase() === "OUTROS";
  const isRegional = redeName.startsWith("REGIONAL_");

  // Consulta do Farol sob demanda com AbortController
  useEffect(() => {
    if (!isOpen || isOutros || isRegional) {
      setFarolData(null);
      setFarolLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchFarol = async () => {
      try {
        setFarolLoading(true);
        setFarolError(null);

        const cod = codigoMatriz || redeName;
        const params = new URLSearchParams({
          codParceiro: cod,
          clienteId: cod,
        });

        const res = await fetch(`/api/inovacoes/crm/farol?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Farol não disponível (${res.status})`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          setFarolData(json.data);
        } else {
          setFarolData(null);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setFarolError(err.message || "Erro ao consultar Farol 360°.");
          setFarolData(null);
        }
      } finally {
        setFarolLoading(false);
      }
    };

    fetchFarol();

    return () => {
      controller.abort();
    };
  }, [isOpen, redeName, codigoMatriz, isOutros, isRegional]);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalProjetado = projections.reduce((acc, v) => acc + (Number(v) || 0), 0);
  const gapReais = Math.max(0, curMeta - (totalProjetado > 0 ? totalProjetado : curReal));
  const atingimentoPct = curMeta > 0 ? ((totalProjetado > 0 ? totalProjetado : curReal) / curMeta) * 100 : 0;

  const handleCreateFollowUp = () => {
    if (!onOpenFollowUp) return;
    const cod = codigoMatriz || redeName;
    const mesStr = String(month).padStart(2, "0");

    onOpenFollowUp({
      clienteNome: redeName,
      origem: "RPS_COMPROMISSO",
      origem_ref: `RPS_OPP_${cod}_${year}_${mesStr}_RECUPERACAO_VOLUME`,
      gap_original_reais: gapReais > 0 ? gapReais : undefined,
      descricao: `Ação decorrente do alinhamento da RPS (${year}-${mesStr}) para a rede ${redeName} sob gestão de ${managerName}. Meta: ${formatCurrency(curMeta)} | Projeção: ${formatCurrency(totalProjetado)}.`,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Main Drawer Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[540px] md:w-[580px] bg-slate-950 border-l border-slate-800 z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhamento 360 da Rede ${redeName}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-100">{redeName}</h2>
              <div className="text-xs text-slate-400">
                {codigoMatriz ? `Matriz: ${codigoMatriz}` : "Rede Comercial"} {uf ? `• UF: ${uf}` : ""}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Card Resumo do Gerente & Competência */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4 text-amber-500" />
                <span>Gerente: <strong className="text-slate-200">{managerName}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4 text-amber-500" />
                <span>Competência: <strong className="text-slate-200">{String(month).padStart(2, '0')}/{year}</strong></span>
              </div>
            </div>
          </div>

          {/* Card de Projeção Semanal e Gap */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Compromisso Semanal (RPS)
            </h4>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Real Acumulado</div>
                <div className="text-sm font-black text-slate-100 mt-0.5">{formatCurrency(curReal)}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Desafio Oficial</div>
                <div className="text-sm font-black text-slate-100 mt-0.5">{formatCurrency(curMeta)}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Projeção Mês</div>
                <div className="text-sm font-black text-amber-400 mt-0.5">{formatCurrency(totalProjetado)}</div>
              </div>
            </div>

            {/* Gap Financeiro */}
            {gapReais > 0 ? (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-400 uppercase">Gap Semanal em Aberto</span>
                  <div className="text-base font-black text-rose-300">{formatCurrency(gapReais)}</div>
                  <div className="text-[10px] text-rose-400/80 mt-0.5">
                    Projeção atual em {atingimentoPct.toFixed(1)}% da meta
                  </div>
                </div>
                <Flame className="w-6 h-6 text-rose-400 animate-pulse" />
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Meta Superada / No Ritmo</span>
                  <div className="text-base font-black text-emerald-300">{formatCurrency(totalProjetado)}</div>
                  <div className="text-[10px] text-emerald-400/80 mt-0.5">
                    Projeção em {atingimentoPct.toFixed(1)}% do Desafio
                  </div>
                </div>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
            )}

            {/* Distribuição Semanal S1..S5 */}
            {mondays.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Distribuição Semanal de Projeções</div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {mondays.map((mDate, i) => (
                    <div key={mDate} className="bg-slate-950/60 p-2 rounded border border-slate-800/60">
                      <div className="text-[9px] text-slate-500 font-bold">S{i + 1}</div>
                      <div className="text-[11px] font-bold text-slate-200 mt-0.5">
                        {formatCurrency(projections[i] || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ═══ FAROL COMERCIAL & FINANCEIRO 360° ═══ */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Farol Comercial & Financeiro (Wave B.9)
            </h4>

            {isOutros ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                <Layers className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  <strong className="text-slate-200">Agrupamento Consolidado de Outras Redes</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Esta linha reúne múltiplos clientes menores sem vinculação a um código de matriz único.
                  </p>
                </div>
              </div>
            ) : isRegional ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                <Layers className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  <strong className="text-slate-200">Ação de Âmbito Regional</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Esta ação abrange múltiplos PDVs da Regional.
                  </p>
                </div>
              </div>
            ) : farolLoading ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 animate-pulse space-y-2" aria-busy="true">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-8 bg-slate-800 rounded w-2/3" />
              </div>
            ) : farolData ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* Adimplência */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Adimplência Operacional</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {farolData.adimplencia.status === "EM_DIA" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          EM DIA
                        </span>
                      ) : farolData.adimplencia.status === "INADIMPLENTE" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                          INADIMPLENTE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                          INDISPONÍVEL
                        </span>
                      )}
                    </div>
                    {farolData.adimplencia.titulosVencidosCount > 0 && (
                      <div className="text-[10px] text-rose-400 mt-1 font-semibold">
                        {farolData.adimplencia.titulosVencidosCount} título(s) vencido(s) (Maior: {farolData.adimplencia.maiorAtrasoDias}d)
                      </div>
                    )}
                  </div>

                  {/* Carta de Anuência */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Carta de Anuência</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {farolData.cartaAnuencia.status === "VIGENTE" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          VIGENTE
                        </span>
                      ) : farolData.cartaAnuencia.status === "PENDENTE" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PENDENTE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                          {farolData.cartaAnuencia.status}
                        </span>
                      )}
                    </div>
                    {farolData.cartaAnuencia.diasParaExpirar !== null && (
                      <div className="text-[10px] text-slate-400 mt-1">
                        Expira em {farolData.cartaAnuencia.diasParaExpirar} dia(s)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>Farol Comercial indisponível ou sem cadastro ativo no Sankhya.</span>
              </div>
            )}
          </div>

          {/* Ação 1-Clique: Criar Follow-Up */}
          {!isOutros && onOpenFollowUp && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleCreateFollowUp}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Criar Ação de Follow-up (RPS Compromisso)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
