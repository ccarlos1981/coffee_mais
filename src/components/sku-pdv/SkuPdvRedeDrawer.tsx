"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  Building2,
  User,
  DollarSign,
  Package,
  TrendingUp,
  AlertCircle,
  Plus,
  Loader2,
  CheckCircle2,
  MapPin,
  FileText,
  Layers,
  Percent,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";
import type { FollowUpInitialContext } from "@/app/processo-comercial/follow-up/components/NewFollowUpModal";

export interface SkuPdvRedeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  context: {
    clienteNome: string;
    clienteId?: string | null;
    codParceiro?: string | null;
    redeNome?: string | null;
    codigoMatriz?: string | null;
    gerenteNome?: string | null;
    uf?: string | null;
    cidade?: string | null;
    faturamentoReal?: number;
    skusVendidos?: number;
    totalPortfolio?: number;
    pctPenetracao?: number;
    avgSkusPerPdv?: number;
    dataStr: string;
  };
  onOpenFollowUp?: (context: FollowUpInitialContext) => void;
}

export function SkuPdvRedeDrawer({
  isOpen,
  onClose,
  context,
  onOpenFollowUp,
}: SkuPdvRedeDrawerProps) {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(
    context.codigoMatriz || context.codParceiro || context.clienteId || context.redeNome || context.clienteNome || null
  );
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  // Sincronizar seleção quando contexto mudar
  useEffect(() => {
    setSelectedNetwork(
      context.codigoMatriz || context.codParceiro || context.clienteId || context.redeNome || context.clienteNome || null
    );
  }, [
    context.codigoMatriz,
    context.codParceiro,
    context.clienteId,
    context.redeNome,
    context.clienteNome,
    context.dataStr,
  ]);

  // Consulta do Farol sob demanda com AbortController
  useEffect(() => {
    if (!isOpen || !selectedNetwork) {
      setFarolData(null);
      setFarolLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchFarol = async () => {
      try {
        setFarolLoading(true);
        setFarolError(null);

        const params = new URLSearchParams({
          codParceiro: selectedNetwork,
          clienteId: selectedNetwork,
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
  }, [isOpen, selectedNetwork]);

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

  const cleanCod = (context.codigoMatriz || context.codParceiro || context.clienteId || "SKUPDV")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();

  const clienteSlug = (context.clienteNome || context.redeNome || "CLIENTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase()
    .slice(0, 25);

  const pct = context.pctPenetracao !== undefined
    ? context.pctPenetracao
    : context.totalPortfolio && context.totalPortfolio > 0 && context.skusVendidos !== undefined
      ? (context.skusVendidos / context.totalPortfolio) * 100
      : 0;

  const handleCreateFollowUp = () => {
    if (!onOpenFollowUp) return;

    onOpenFollowUp({
      clienteNome: context.clienteNome || selectedNetwork || "Cliente SKU PDV",
      origem: "COCKPIT_PRESCRITIVO",
      origem_ref: `SKUPDV_${cleanCod}_${clienteSlug}_${context.dataStr}`,
      tipo_acao: "EXPANSAO_MIX",
      descricao: `Ação de Expansão de Mix de Produtos para ${context.clienteNome} (Rede: ${context.redeNome || 'Direto'} | Gerente: ${context.gerenteNome || 'Comercial'} | Faturamento: ${formatCurrency(context.faturamentoReal || 0)} | SKUs Comprados: ${context.skusVendidos || 0}/${context.totalPortfolio || 0} [${pct.toFixed(1)}%]). Alinhamento comercial para introdução de novos itens do portfólio Coffee++.`,
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
        className="fixed top-0 right-0 h-full w-full sm:w-[520px] md:w-[560px] bg-slate-950 border-l border-slate-800 z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-label="Diagnóstico 360 de Penetração de SKU"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-tight">
                Diagnóstico 360° de Penetração de SKU
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                {context.clienteNome} • Período: {context.dataStr}
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
          {/* Card Contexto do Cliente & Mix */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              Penetração de Portfólio & Mix
            </h4>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs space-y-2">
              <div className="text-slate-200 font-bold text-sm">
                {context.clienteNome}
              </div>
              {context.redeNome && (
                <div className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Matriz / Rede: <strong className="text-slate-200">{context.redeNome}</strong></span>
                </div>
              )}
              <div className="flex items-center gap-4 text-slate-400 pt-1 border-t border-slate-850">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" />
                  <span>Gerente: <strong className="text-slate-200">{context.gerenteNome || "Comercial"}</strong></span>
                </div>
                {(context.cidade || context.uf) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    <span>Região: <strong className="text-slate-200">{context.cidade ? `${context.cidade} / ${context.uf}` : context.uf}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de Progresso de Penetração de Portfólio */}
            <div className="bg-slate-950/50 border border-slate-850 p-3 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-amber-400" />
                  Taxa de Penetração de Mix
                </span>
                <span className="font-bold text-amber-400 text-sm">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    pct >= 50 ? "bg-emerald-500" : pct >= 25 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between pt-0.5">
                <span>SKUs Ativos: <strong className="text-slate-200">{context.skusVendidos || 0}</strong></span>
                <span>Portfólio Total Cia: <strong className="text-slate-200">{context.totalPortfolio || 0}</strong></span>
              </div>
            </div>

            {/* Grid Financeiro & Médias */}
            <div className="grid grid-cols-2 gap-3 text-xs pt-1">
              <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  Faturamento Acumulado
                </div>
                <div className="text-sm font-bold text-slate-100 mt-1">
                  {formatCurrency(context.faturamentoReal || 0)}
                </div>
              </div>

              <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  Média SKU por PDV
                </div>
                <div className="text-sm font-bold text-slate-100 mt-1">
                  {context.avgSkusPerPdv !== undefined ? formatNumber(context.avgSkusPerPdv, 2) : formatNumber(context.skusVendidos || 0, 1)}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ FAROL COMERCIAL & FINANCEIRO 360° ═══ */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Farol Comercial & Financeiro (Wave B.9)
            </h4>

            {!selectedNetwork ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>DADOS_INDISPONIVEIS — Nenhuma rede vinculada</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O registro atual não possui código de matriz oficial ou identificador direto vinculado.
                  Para consultar o Farol e despachar Follow-Up de Expansão de Mix, informe o código da matriz ou nome da rede abaixo:
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Ex: 102030, ZAFFARI, CARREFOUR..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value.trim()) {
                        setSelectedNetwork(e.currentTarget.value.trim());
                      }
                    }}
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      if (input && input.value.trim()) {
                        setSelectedNetwork(input.value.trim());
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Vincular
                  </button>
                </div>
              </div>
            ) : farolLoading ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 animate-pulse space-y-2" aria-busy="true">
                <div className="h-4 bg-slate-800 rounded w-1/3" />
                <div className="h-8 bg-slate-800 rounded w-2/3" />
              </div>
            ) : farolData ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-slate-200">{selectedNetwork}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNetwork(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Alterar rede
                  </button>
                </div>

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
                <span>Farol Comercial indisponível ou sem cadastro ativo no Sankhya para {selectedNetwork}.</span>
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
                Criar Ação de Follow-up (Expansão de Mix de SKUs)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
