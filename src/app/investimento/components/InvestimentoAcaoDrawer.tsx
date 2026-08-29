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
  CheckCircle2,
  Tag,
  Package,
} from "lucide-react";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";
import type { FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";
import { MOTIVOS_DIVERGENCIA, MotivoDivergencia } from "../divergencia-constants";

export interface InvestimentoAcaoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  acao: {
    id: string;
    rede: string;
    codigo_matriz?: string | null;
    uf?: string | null;
    gerente_responsavel?: string | null;
    tipo_acao: string;
    valor_investimento?: number | null;
    apuracao_valor_realizado?: number | null;
    expectativa_volume?: number | null;
    data_inicio: string;
    data_fim: string;
    status_trade?: string | null;
    status_financeiro?: string | null;
    possui_divergencia_calendario?: boolean | null;
    data_inicio_real?: string | null;
    data_fim_real?: string | null;
    motivo_divergencia_calendario?: string | null;
    observacao_divergencia?: string | null;
  };
  onOpenFollowUp?: (context: FollowUpInitialContext) => void;
}

const formatCurrency = (val: number | null | undefined) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function InvestimentoAcaoDrawer({
  isOpen,
  onClose,
  acao,
  onOpenFollowUp,
}: InvestimentoAcaoDrawerProps) {
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  const isRegional = acao.rede.startsWith("REGIONAL_");

  // Consulta do Farol sob demanda com AbortController
  useEffect(() => {
    if (!isOpen || isRegional) {
      setFarolData(null);
      setFarolLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchFarol = async () => {
      try {
        setFarolLoading(true);
        setFarolError(null);

        const cod = acao.codigo_matriz || acao.rede;
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
  }, [isOpen, acao.rede, acao.codigo_matriz, isRegional]);

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

  const valorInvest = acao.valor_investimento || 0;
  const valorRealizado = acao.apuracao_valor_realizado || 0;

  const handleCreateFollowUp = () => {
    if (!onOpenFollowUp) return;
    const cod = acao.codigo_matriz || acao.rede;

    onOpenFollowUp({
      clienteNome: acao.rede,
      origem: "COCKPIT_PRESCRITIVO",
      origem_ref: `INV_ACAO_${acao.id}_CONTRAPARTIDA`,
      gap_original_reais: valorInvest > 0 ? valorInvest : undefined,
      descricao: `Acompanhamento de contrapartida/evidência da ação de investimento (${acao.tipo_acao}) para a rede ${acao.rede} sob gestão de ${acao.gerente_responsavel || "Sem Gerente"}. Valor: ${formatCurrency(valorInvest)}.`,
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
        aria-label={`Detalhamento 360 da Ação de Investimento - ${acao.rede}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-tight">{acao.rede}</h2>
              <div className="text-xs text-slate-400 mt-0.5">
                {acao.codigo_matriz ? `Matriz: ${acao.codigo_matriz}` : "Rede Comercial"} {acao.uf ? `• UF: ${acao.uf}` : ""}
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
          {/* Card Resumo do Gerente & Tipo de Ação */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Gerente: <strong className="text-slate-200">{acao.gerente_responsavel || "Sem Gerente"}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Tag className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Tipo: <strong className="text-slate-200">{acao.tipo_acao}</strong></span>
              </div>
            </div>
          </div>

          {/* Card Financeiro do Investimento */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              Valores do Investimento
            </h4>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Valor Planejado</div>
                <div className="text-sm font-black text-amber-400 mt-0.5">{formatCurrency(valorInvest)}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Valor Apurado</div>
                <div className="text-sm font-black text-slate-100 mt-0.5">{formatCurrency(valorRealizado)}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Expectativa Volume</div>
                <div className="text-sm font-black text-slate-200 mt-0.5">
                  {acao.expectativa_volume ? `${Number(acao.expectativa_volume).toLocaleString('pt-BR')} kg` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Card de Calendário e Divergência Operacional (Baseline 8) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              Calendário & Execução
            </h4>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Vigência Comercial Planejada:</span>
                <span className="font-bold text-slate-200">
                  {formatDate(acao.data_inicio)} até {formatDate(acao.data_fim)}
                </span>
              </div>

              {acao.possui_divergencia_calendario ? (
                <div className="pt-2 border-t border-rose-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Divergência Operacional de Calendário (Trade)
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-400">Período Real: </span>
                    <strong className="text-amber-200">{formatDate(acao.data_inicio_real)} até {formatDate(acao.data_fim_real)}</strong>
                  </div>
                  {acao.motivo_divergencia_calendario && (
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400">Motivo: </span>
                      <span className="font-semibold text-slate-200">
                        {MOTIVOS_DIVERGENCIA[acao.motivo_divergencia_calendario as MotivoDivergencia] || acao.motivo_divergencia_calendario}
                      </span>
                    </div>
                  )}
                  {acao.observacao_divergencia && (
                    <p className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded border border-slate-800">
                      &quot;{acao.observacao_divergencia}&quot;
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Execução 100% alinhada ao calendário comercial planejado</span>
                </div>
              )}
            </div>
          </div>

          {/* ═══ FAROL COMERCIAL & FINANCEIRO 360° ═══ */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Farol Comercial & Financeiro da Rede (Wave B.9)
            </h4>

            {isRegional ? (
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
          {onOpenFollowUp && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handleCreateFollowUp}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Criar Ação de Follow-up (Contrapartida Investimento)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
