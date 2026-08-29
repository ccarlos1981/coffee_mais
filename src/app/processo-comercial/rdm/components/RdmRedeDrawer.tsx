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
  Plus,
  Loader2,
  CheckCircle2,
  Package,
  Layers,
  MapPin,
  TrendingDown,
} from "lucide-react";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";
import type { FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";

export interface RdmRedeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rede: {
    nome: string;
    codigo_matriz?: string | null;
    uf?: string | null;
    gerente?: string | null;
    faturamentoReal?: number;
    metaFaturamento?: number;
    volumeReal?: number;
    metaVolume?: number;
    maco?: number;
    macoPct?: number;
    rollingFat3M?: number;
    year: number;
    month: number;
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

export function RdmRedeDrawer({
  isOpen,
  onClose,
  rede,
  onOpenFollowUp,
}: RdmRedeDrawerProps) {
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  const isRegional = rede.nome.startsWith("REGIONAL_") || rede.nome.toUpperCase() === "OUTROS";

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

        const cod = rede.codigo_matriz || rede.nome;
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
  }, [isOpen, rede.nome, rede.codigo_matriz, isRegional]);

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

  const realFat = rede.faturamentoReal || 0;
  const metaFat = rede.metaFaturamento || 0;
  const gapFat = metaFat > realFat ? metaFat - realFat : 0;
  const atingimentoPct = metaFat > 0 ? (realFat / metaFat) * 100 : realFat > 0 ? 100 : 0;

  const handleCreateFollowUp = () => {
    if (!onOpenFollowUp) return;
    const cod = rede.codigo_matriz || rede.nome;

    onOpenFollowUp({
      clienteNome: rede.nome,
      origem: "COCKPIT_PRESCRITIVO",
      origem_ref: `RDM_PLANO_${cod}_${rede.year}_${rede.month}_RECUPERACAO_VOLUME`,
      gap_original_reais: gapFat > 0 ? gapFat : undefined,
      descricao: `Acompanhamento de compromisso de desdobramento RDM para a rede ${rede.nome} sob gestão de ${rede.gerente || "Sem Gerente"}. Gap de Faturamento no mês: ${formatCurrency(gapFat)}.`,
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
        aria-label={`Diagnóstico 360 RDM da Rede - ${rede.nome}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-tight">{rede.nome}</h2>
              <div className="text-xs text-slate-400 mt-0.5">
                {rede.codigo_matriz ? `Matriz: ${rede.codigo_matriz}` : "Rede Comercial"} {rede.uf ? `• UF: ${rede.uf}` : ""}
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
          {/* Card Contexto Gerencial */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Gerente: <strong className="text-slate-200">{rede.gerente || "Sem Gerente"}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Competência: <strong className="text-slate-200">{rede.month.toString().padStart(2, '0')}/{rede.year}</strong></span>
              </div>
            </div>
          </div>

          {/* Card Performance do Mês (Real vs Meta) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Resultado Comercial do Mês
            </h4>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Realizado</div>
                <div className="text-sm font-black text-amber-400 mt-0.5">{formatCurrency(realFat)}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Meta Mensal</div>
                <div className="text-sm font-black text-slate-100 mt-0.5">{metaFat > 0 ? formatCurrency(metaFat) : "—"}</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Atingimento</div>
                <div className={`text-sm font-black mt-0.5 ${atingimentoPct >= 100 ? 'text-emerald-400' : atingimentoPct >= 85 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {metaFat > 0 ? `${atingimentoPct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            {/* Gap de Faturamento */}
            {gapFat > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-rose-400 font-semibold flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  Gap de Faturamento para a Meta:
                </span>
                <span className="font-bold text-rose-300 font-mono">
                  {formatCurrency(gapFat)}
                </span>
              </div>
            )}
          </div>

          {/* Card Volume & Rentabilidade */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-500" />
              Volume & Rentabilidade
            </h4>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Volume (kg)</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {rede.volumeReal ? `${Number(rede.volumeReal).toLocaleString('pt-BR')} kg` : "—"}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">MACO (R$)</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5">
                  {rede.maco !== undefined ? formatCurrency(rede.maco) : "—"}
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">% MACO</div>
                <div className={`text-sm font-bold mt-0.5 ${rede.macoPct !== undefined && rede.macoPct >= 10 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {rede.macoPct !== undefined ? `${Number(rede.macoPct).toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>

            {rede.rollingFat3M !== undefined && rede.rollingFat3M > 0 && (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-2.5 text-xs text-slate-400 flex items-center justify-between">
                <span>Rolling FAT 3 Meses Fechados:</span>
                <span className="font-bold text-slate-200 font-mono">{formatCurrency(rede.rollingFat3M)}</span>
              </div>
            )}
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
                  <strong className="text-slate-200">Linha de Agrupamento Regional / Outros</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Esta linha consolida múltiplos PDVs da carteira.
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
                Criar Ação de Follow-up (Recuperação RDM)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
