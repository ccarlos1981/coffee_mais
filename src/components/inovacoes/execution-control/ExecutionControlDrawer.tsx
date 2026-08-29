"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Loader2,
  Calendar,
  User,
  Building2,
  Tag,
  FileText,
  History,
  ShieldCheck,
  DollarSign,
  AlertCircle,
  FileCheck,
  TrendingUp,
  Layers,
  Sparkles,
} from "lucide-react";
import type {
  FollowUpActionRecord,
  FollowUpHistoryRecord,
  FollowUpStatus,
} from "@/lib/services/follow-up-service";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";

export interface ExecutionControlDrawerProps {
  actionId: string | null;
  onClose: () => void;
  onActionUpdated: () => void;
  userRole?: string;
}

const STATUS_CONFIG: Record<FollowUpStatus, { label: string; className: string; icon: any }> = {
  PENDENTE: { label: "Pendente", className: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: Clock },
  EM_ANDAMENTO: { label: "Em Andamento", className: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Play },
  CONCLUIDA: { label: "Concluída", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  NAO_EFETIVA: { label: "Não Efetiva", className: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  CANCELADA: { label: "Cancelada", className: "bg-slate-500/15 text-slate-400 border-slate-500/30", icon: XCircle },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; className: string }> = {
  CRITICA: { label: "Crítica", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  ALTA: { label: "Alta", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  MEDIA: { label: "Média", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  BAIXA: { label: "Baixa", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const ORIGEM_LABELS: Record<string, string> = {
  COCKPIT_PRESCRITIVO: "Cockpit Prescritivo",
  RANKING_PERFORMANCE: "Ranking Performance",
  ALERTA_QUEDA: "Alerta de Queda",
  RPS_COMPROMISSO: "RPS Compromisso",
  MANUAL: "Manual",
};

const TIPO_LABELS: Record<string, string> = {
  REATIVACAO_CLIENTE: "Reativação de Cliente",
  EXPANSAO_MIX: "Expansão de Mix",
  RECUPERACAO_VOLUME: "Recuperação de Volume",
  NEGOCIACAO_REDE: "Negociação em Rede",
  VISITA_COMERCIAL: "Visita Comercial",
  ENVIO_PROPOSTA: "Envio de Proposta",
  OUTRO: "Outra Ação",
};

const formatCurrency = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);
};

export function ExecutionControlDrawer({
  actionId,
  onClose,
  onActionUpdated,
  userRole = "Gerente de Campo",
}: ExecutionControlDrawerProps) {
  const [action, setAction] = useState<FollowUpActionRecord | null>(null);
  const [history, setHistory] = useState<FollowUpHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Farol 360 State
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  // Status Transition Modal State
  const [activeModal, setActiveModal] = useState<"CONCLUIR" | "NAO_EFETIVA" | "CANCELAR" | "REABRIR" | null>(null);
  const [resultadoInput, setResultadoInput] = useState("");
  const [motivoCancelamentoInput, setMotivoCancelamentoInput] = useState("");
  const [observacaoInput, setObservacaoInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!actionId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/follow-up/${actionId}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success && json.data) {
        setAction(json.data.action);
        setHistory(json.data.history || []);
      } else {
        setError(json.error || "Erro ao carregar detalhes do follow-up.");
      }
    } catch (err: any) {
      console.error("Erro ao buscar follow-up:", err);
      setError("Falha na conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    if (actionId) {
      fetchDetail();
    } else {
      setAction(null);
      setHistory([]);
      setFarolData(null);
    }
  }, [actionId, fetchDetail]);

  // Fetch Farol On-Demand when action details load
  useEffect(() => {
    if (!action) return;

    const controller = new AbortController();

    async function fetchFarol(signal: AbortSignal) {
      setFarolLoading(true);
      setFarolError(null);
      try {
        const params = new URLSearchParams();
        if (action?.cliente_id) params.set("clienteId", action.cliente_id);
        if (action?.rede) params.set("redeNome", action.rede);

        const res = await fetch(`/api/inovacoes/crm/farol?${params.toString()}`, {
          signal,
          cache: "no-store",
        });
        const json = await res.json();

        if (json.success && json.data) {
          setFarolData(json.data);
        } else {
          setFarolError(json.error || "DADOS INDISPONÍVEIS");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Erro ao consultar Farol 360:", err);
          setFarolError("DADOS INDISPONÍVEIS");
        }
      } finally {
        setFarolLoading(false);
      }
    }

    fetchFarol(controller.signal);

    return () => {
      controller.abort();
    };
  }, [action]);

  // Keyboard navigation (ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeModal) {
          setActiveModal(null);
        } else {
          onClose();
        }
      }
    };
    if (actionId) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionId, activeModal, onClose]);

  // Status transitions
  const handleTransition = async (newStatus: FollowUpStatus) => {
    if (!actionId) return;
    try {
      setSubmitting(true);
      setModalError(null);

      const payload: any = { status: newStatus };
      if (newStatus === "CONCLUIDA") {
        payload.resultado = resultadoInput.trim();
        payload.observacao = observacaoInput.trim() || undefined;
      } else if (newStatus === "NAO_EFETIVA") {
        payload.resultado = resultadoInput.trim();
        payload.motivo_cancelamento = motivoCancelamentoInput.trim();
        payload.observacao = observacaoInput.trim() || undefined;
      } else if (newStatus === "CANCELADA") {
        payload.motivo_cancelamento = motivoCancelamentoInput.trim();
        payload.observacao = observacaoInput.trim() || undefined;
      } else if (newStatus === "EM_ANDAMENTO") {
        payload.observacao = observacaoInput.trim() || "Ação iniciada/reaberta pelo gestor.";
      }

      const res = await fetch(`/api/follow-up/${actionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setActiveModal(null);
        setResultadoInput("");
        setMotivoCancelamentoInput("");
        setObservacaoInput("");
        await fetchDetail();
        onActionUpdated();
      } else {
        setModalError(json.error || "Erro ao atualizar status da ação.");
      }
    } catch (err: any) {
      console.error("Erro na transição:", err);
      setModalError("Falha na comunicação com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!actionId) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const statusInfo = action ? (STATUS_CONFIG[action.status] || STATUS_CONFIG.PENDENTE) : STATUS_CONFIG.PENDENTE;
  const StatusIcon = statusInfo.icon;
  const prioridadeInfo = action ? (PRIORIDADE_CONFIG[action.prioridade] || PRIORIDADE_CONFIG.MEDIA) : PRIORIDADE_CONFIG.MEDIA;

  // SLA Classification
  let slaBadge = { label: "No Prazo", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (action) {
    if (["PENDENTE", "EM_ANDAMENTO"].includes(action.status)) {
      if (action.prazo < todayStr) {
        slaBadge = { label: "Atrasada", className: "bg-rose-500/15 text-rose-400 border-rose-500/30" };
      } else if (action.prazo === todayStr) {
        slaBadge = { label: "Vencendo Hoje", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
      }
    } else if (action.status === "CONCLUIDA") {
      if (action.concluded_at && action.concluded_at.slice(0, 10) > action.prazo) {
        slaBadge = { label: "Concluída Fora do Prazo", className: "bg-slate-500/15 text-slate-400 border-slate-500/30" };
      } else {
        slaBadge = { label: "Concluída no Prazo", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
      }
    }
  }

  const isAdmin = ["Admin", "Admin Master", "Diretoria", "Presidência", "CEO"].includes(userRole);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes da Execução - ${action?.cliente_nome || "Carregando"}`}
      aria-busy={loading || submitting}
      onClick={onClose}
    >
      <div
        className="fixed inset-y-0 right-0 flex max-w-full pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-2xl transform bg-slate-900 border-l border-slate-800 shadow-2xl transition ease-in-out duration-300 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-5 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-500/90 font-mono">
                    Torre de Controle 360°
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${slaBadge.className}`}>
                    <Clock className="w-3 h-3" />
                    {slaBadge.label}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-100 tracking-tight mt-0.5 line-clamp-1">
                  {action?.cliente_nome || "Carregando detalhes..."}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
              aria-label="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-sm text-slate-400">Carregando auditoria da ação...</p>
              </div>
            ) : error || !action ? (
              <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-400" />
                <p className="font-semibold">{error || "Ação não encontrada."}</p>
              </div>
            ) : (
              <>
                {/* Identification Card */}
                <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Identificação da Oportunidade
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${prioridadeInfo.className}`}>
                      Prioridade {prioridadeInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block">Rede / Matriz</span>
                      <span className="font-medium text-slate-200">{action.rede || "Venda Direta / Sem Rede"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Gerente Responsável</span>
                      <span className="font-medium text-slate-200">{action.manager_name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Tipo de Ação</span>
                      <span className="font-medium text-slate-200">{TIPO_LABELS[action.tipo_acao] || action.tipo_acao}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Origem Comercial</span>
                      <span className="font-medium text-slate-200">{ORIGEM_LABELS[action.origem] || action.origem}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Prazo de SLA</span>
                      <span className="font-medium text-slate-200 font-mono">
                        {new Date(action.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Gap / Receita em Risco</span>
                      <span className="font-semibold text-amber-400 font-mono">
                        {formatCurrency(action.gap_original_reais)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-xs text-slate-400 block mb-1">Motivo / Prescrição Comercial</span>
                    <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      {action.motivo}
                    </p>
                  </div>
                </div>

                {/* Farol Comercial & Financeiro 360 */}
                <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Farol Comercial & Financeiro 360°
                      </span>
                    </div>
                    {farolLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                  </div>

                  {farolLoading ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Consultando situação financeira do cliente...
                    </div>
                  ) : farolData ? (
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {/* Adimplência */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-400 font-medium block mb-1">Adimplência Operacional</span>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              farolData.adimplencia.status === "EM_DIA"
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                : "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]"
                            }`}
                          />
                          <span className="font-semibold text-slate-200">
                            {farolData.adimplencia.status === "EM_DIA" ? "Em Dia" : "Inadimplente"}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-[11px] text-slate-400">
                          <div>Títulos Vencidos: <span className="text-slate-200 font-mono">{farolData.adimplencia.titulosVencidosCount}</span></div>
                          <div>Maior Atraso: <span className="text-slate-200 font-mono">{farolData.adimplencia.maiorAtrasoDias} dias</span></div>
                          <div>Total Vencido: <span className="text-rose-400 font-mono">{formatCurrency(farolData.adimplencia.valorVencidoTotal)}</span></div>
                        </div>
                      </div>

                      {/* Carta de Anuência */}
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <span className="text-slate-400 font-medium block mb-1">Carta de Anuência</span>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              farolData.cartaAnuencia.status === "VIGENTE"
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                                : farolData.cartaAnuencia.status === "PENDENTE"
                                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                                : "bg-slate-400"
                            }`}
                          />
                          <span className="font-semibold text-slate-200 capitalize">
                            {farolData.cartaAnuencia.status.toLowerCase()}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-[11px] text-slate-400">
                          <div>Competência: <span className="text-slate-200 font-mono">{farolData.cartaAnuencia.competencia || "—"}</span></div>
                          <div>Dias p/ Expirar: <span className="text-slate-200 font-mono">{farolData.cartaAnuencia.diasParaExpirar ?? "—"}</span></div>
                          <div>Validade: <span className="text-slate-200 font-mono">{farolData.cartaAnuencia.validadeAte || "—"}</span></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                      Farol Comercial Indisponível para este cadastro.
                    </div>
                  )}
                </div>

                {/* Efetividade Comercial Pós-Execução */}
                {action.status === "CONCLUIDA" && (
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Efetividade Analítica Pós-Conclusão
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>
                        Ação concluída em{" "}
                        <span className="font-mono text-slate-100 font-semibold">
                          {action.concluded_at ? new Date(action.concluded_at).toLocaleDateString("pt-BR") : "—"}
                        </span>.
                      </p>
                      {action.resultado && (
                        <p className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-200 mt-2">
                          <span className="font-semibold text-emerald-400 block mb-0.5">Resultado da Ação:</span>
                          {action.resultado}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Linha do Tempo & Histórico */}
                <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3">
                    <History className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Linha do Tempo & Auditoria
                    </span>
                  </div>

                  {history.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-500">
                      Nenhum evento adicional registrado.
                    </div>
                  ) : (
                    <div className="relative pl-6 border-l border-slate-800 space-y-4">
                      {history.map((h, idx) => (
                        <div key={h.id || idx} className="relative">
                          <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-amber-500 border-2 border-slate-900" />
                          <div className="text-xs">
                            <div className="flex items-center justify-between text-slate-400 mb-0.5">
                              <span className="font-medium text-slate-200">
                                Transição para <span className="text-amber-400">{h.status_novo}</span>
                              </span>
                              <span className="text-[11px] font-mono">
                                {new Date(h.created_at).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            {h.observacao && (
                              <p className="text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60 text-[11px] mt-1">
                                {h.observacao}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer Actions */}
          {action && !loading && (
            <div className="border-t border-slate-800/80 px-6 py-4 bg-slate-950/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
              >
                Fechar
              </button>

              <div className="flex items-center gap-2">
                {action.status === "PENDENTE" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleTransition("EM_ANDAMENTO")}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 transition-colors flex items-center gap-1.5 shadow-lg shadow-amber-500/10 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Iniciar Execução
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal("CANCELAR")}
                      disabled={submitting}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                )}

                {action.status === "EM_ANDAMENTO" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setActiveModal("CONCLUIR")}
                      disabled={submitting}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluir Ação
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal("NAO_EFETIVA")}
                      disabled={submitting}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-orange-400 hover:bg-orange-500/10 border border-orange-500/20 transition-colors"
                    >
                      Não Efetiva
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal("CANCELAR")}
                      disabled={submitting}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </>
                )}

                {["CONCLUIDA", "NAO_EFETIVA"].includes(action.status) && isAdmin && (
                  <button
                    type="button"
                    onClick={() => setActiveModal("REABRIR")}
                    disabled={submitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reabrir Ação (Admin)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Modal for Status Transitions */}
          {activeModal && (
            <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-slate-100">
                    {activeModal === "CONCLUIR" && "Concluir Ação de Execução"}
                    {activeModal === "NAO_EFETIVA" && "Marcar Ação como Não Efetiva"}
                    {activeModal === "CANCELAR" && "Cancelar Ação"}
                    {activeModal === "REABRIR" && "Reabrir Ação Comercial"}
                  </h3>
                  <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-100">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    {modalError}
                  </div>
                )}

                {(activeModal === "CONCLUIR" || activeModal === "NAO_EFETIVA") && (
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Resultado Comercial Obtido *
                    </label>
                    <textarea
                      value={resultadoInput}
                      onChange={(e) => setResultadoInput(e.target.value)}
                      placeholder="Descreva o desfecho comercial (ex: Pedido fechado de R$ 15.000, 3 novos SKUs incluídos)..."
                      className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {(activeModal === "NAO_EFETIVA" || activeModal === "CANCELAR") && (
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Motivo {activeModal === "CANCELAR" ? "do Cancelamento" : "da Não Efetividade"} *
                    </label>
                    <textarea
                      value={motivoCancelamentoInput}
                      onChange={(e) => setMotivoCancelamentoInput(e.target.value)}
                      placeholder="Informe o motivo impeditivo (ex: Cliente sem limite de crédito, recusa comercial da rede)..."
                      className="w-full h-20 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {activeModal === "REABRIR" && (
                  <p className="text-xs text-slate-400">
                    Você está prestes a reabrir esta ação comercial. O status retornará para{" "}
                    <span className="text-amber-400 font-semibold">EM_ANDAMENTO</span>.
                  </p>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">
                    Observações Adicionais (Opcional)
                  </label>
                  <input
                    type="text"
                    value={observacaoInput}
                    onChange={(e) => setObservacaoInput(e.target.value)}
                    placeholder="Comentário interno da equipe..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (activeModal === "CONCLUIR") handleTransition("CONCLUIDA");
                      if (activeModal === "NAO_EFETIVA") handleTransition("NAO_EFETIVA");
                      if (activeModal === "CANCELAR") handleTransition("CANCELADA");
                      if (activeModal === "REABRIR") handleTransition("EM_ANDAMENTO");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirmar Transição
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
