"use client";

import React, { useEffect, useState, useCallback } from "react";
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
  Layers,
  Flame,
} from "lucide-react";
import type {
  FollowUpActionRecord,
  FollowUpHistoryRecord,
  FollowUpStatus,
} from "@/lib/services/follow-up-service";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";

interface FollowUpDrawerProps {
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val || 0);
};

export function FollowUpDrawer({ actionId, onClose, onActionUpdated, userRole }: FollowUpDrawerProps) {
  const [action, setAction] = useState<FollowUpActionRecord | null>(null);
  const [history, setHistory] = useState<FollowUpHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Farol 360 State
  const [farolData, setFarolData] = useState<ClientFarolSummary | null>(null);
  const [farolLoading, setFarolLoading] = useState(false);
  const [farolError, setFarolError] = useState<string | null>(null);

  // Transition Modal State
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
    fetchDetail();
  }, [fetchDetail]);

  // Carregamento sob demanda do Farol 360° com AbortController
  useEffect(() => {
    if (!action || !action.cliente_id) {
      setFarolData(null);
      setFarolLoading(false);
      return;
    }

    // Se for uma ação de âmbito regional, não consulta Farol de parceiro
    if (action.cliente_id.startsWith("REGIONAL_")) {
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
          codParceiro: action.cliente_id,
          clienteId: action.cliente_id,
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
          setFarolError(err.message || "Erro ao carregar Farol 360°.");
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
  }, [action]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !activeModal) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, activeModal]);

  if (!actionId) return null;

  const isAdmin = ["Admin", "Admin Master"].includes(userRole || "");

  const handleStatusTransition = async (targetStatus: FollowUpStatus) => {
    setSubmitting(true);
    setModalError(null);

    try {
      const payload: any = { status: targetStatus };
      if (resultadoInput.trim()) payload.resultado = resultadoInput.trim();
      if (motivoCancelamentoInput.trim()) payload.motivo_cancelamento = motivoCancelamentoInput.trim();
      if (observacaoInput.trim()) payload.observacao = observacaoInput.trim();

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
        fetchDetail();
        onActionUpdated();
      } else {
        setModalError(json.error || "Erro ao atualizar status.");
      }
    } catch (err: any) {
      console.error("Erro na transição:", err);
      setModalError("Falha na comunicação com a API.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartAction = async () => {
    handleStatusTransition("EM_ANDAMENTO");
  };

  // Cálculo e semântica do SLA
  const calculateSla = (prazoStr: string, status: FollowUpStatus) => {
    if (status === "CONCLUIDA") {
      return { label: "Concluída", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    }
    if (status === "NAO_EFETIVA" || status === "CANCELADA") {
      return { label: "Encerrada", badgeClass: "bg-slate-800 text-slate-400 border-slate-700" };
    }
    const [y, m, d] = prazoStr.split("-").map(Number);
    const prazoDate = new Date(y, m - 1, d);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((prazoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Vencida há ${Math.abs(diffDays)} dia(s)`,
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse",
      };
    }
    if (diffDays === 0) {
      return { label: "Vence Hoje (Crítico)", badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold" };
    }
    if (diffDays <= 3) {
      return {
        label: `Vence em ${diffDays} dia(s) (Em Risco)`,
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    }
    return {
      label: `${diffDays} dia(s) restantes (No Prazo)`,
      badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    };
  };

  const statusCfg = action ? STATUS_CONFIG[action.status] : null;
  const prioCfg = action ? (PRIORIDADE_CONFIG[action.prioridade] || PRIORIDADE_CONFIG.MEDIA) : null;
  const StatusIcon = statusCfg?.icon;
  const isRegionalAction = action?.cliente_id?.startsWith("REGIONAL_");
  const slaInfo = action ? calculateSla(action.prazo, action.status) : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity" onClick={onClose} />

      {/* Main Drawer Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full sm:w-[540px] md:w-[600px] bg-slate-950 border-l border-slate-800 z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300 text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhamento de Follow-up 360"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-100">Cockpit Follow-up 360°</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3" aria-busy="true">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <span className="text-xs font-semibold text-slate-400 tracking-widest uppercase animate-pulse">
                Carregando detalhes da ação...
              </span>
            </div>
          ) : error ? (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs font-semibold text-rose-400">{error}</p>
              <button
                onClick={fetchDetail}
                className="px-4 py-2 bg-rose-500/20 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/30 hover:bg-rose-500/30 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : action ? (
            <>
              {/* Client & Badges Bar */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-100">{action.cliente_nome}</h3>
                    {action.rede && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Rede: {action.rede}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 justify-end">
                    {statusCfg && StatusIcon && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusCfg.label}
                      </span>
                    )}
                    {prioCfg && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${prioCfg.className}`}>
                        {prioCfg.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>Gerente: <strong className="text-slate-200">{action.manager_name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <span>Prazo: <strong className="text-slate-200">{new Date(action.prazo).toLocaleDateString("pt-BR")}</strong></span>
                  </div>
                </div>

                {/* SLA Countdown Badge */}
                {slaInfo && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> SLA de Resolução:
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${slaInfo.badgeClass}`}>
                      {slaInfo.label}
                    </span>
                  </div>
                )}
              </div>

              {/* ═══ FAROL COMERCIAL & FINANCEIRO 360° ═══ */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Farol Comercial & Financeiro (Wave B.9)
                </h4>

                {isRegionalAction ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                    <Layers className="w-5 h-5 text-purple-400 flex-shrink-0" />
                    <div className="text-xs text-slate-300">
                      <strong className="text-slate-200">Ação Executiva de Âmbito Regional</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Esta ação decorre do Fechamento Executivo da Regional e não possui vínculo com um PDV individual.
                      </p>
                    </div>
                  </div>
                ) : farolLoading ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 animate-pulse space-y-2">
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

              {/* ═══ CONTEXTO DA PRESCRIÇÃO & GAP ═══ */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Contexto da Prescrição
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Origem da Oportunidade</div>
                    <div className="text-xs font-bold text-slate-100 mt-0.5">
                      {ORIGEM_LABELS[action.origem] || action.origem}
                    </div>
                    {action.origem_ref && (
                      <div className="text-[10px] text-slate-500 truncate mt-0.5" title={action.origem_ref}>
                        Ref: {action.origem_ref}
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Tipo de Ação Prescrita</div>
                    <div className="text-xs font-bold text-slate-100 mt-0.5">
                      {TIPO_LABELS[action.tipo_acao] || action.tipo_acao}
                    </div>
                  </div>
                </div>

                {/* Gap Original */}
                {action.gap_original_reais !== undefined && action.gap_original_reais !== null && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-400 uppercase">Gap Financeiro Original</span>
                      <div className="text-base font-extrabold text-amber-300">
                        {formatCurrency(action.gap_original_reais)}
                      </div>
                    </div>
                    <Flame className="w-5 h-5 text-amber-400" />
                  </div>
                )}

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Motivo / Diagnóstico</div>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">{action.motivo}</p>
                </div>

                {action.descricao && (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-1">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Descrição Detalhada</div>
                    <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line">{action.descricao}</p>
                  </div>
                )}
              </div>

              {/* Results (if available) */}
              {(action.resultado || action.motivo_cancelamento) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Resultado & Conclusão
                  </h4>

                  {action.resultado && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-emerald-400 font-semibold uppercase">Resultado da Ação</div>
                      <p className="text-xs text-slate-200 font-medium">{action.resultado}</p>
                    </div>
                  )}

                  {action.motivo_cancelamento && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 space-y-1">
                      <div className="text-[10px] text-rose-400 font-semibold uppercase">Motivo do Cancelamento / Não Efetividade</div>
                      <p className="text-xs text-slate-200 font-medium">{action.motivo_cancelamento}</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Histórico de Transições ({history.length})
                </h4>

                <div className="space-y-2 border-l-2 border-slate-800 ml-2 pl-4 py-1">
                  {history.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">Nenhuma transição registrada.</p>
                  ) : (
                    history.map((h) => {
                      const newStatusCfg = STATUS_CONFIG[h.status_novo];
                      return (
                        <div key={h.id} className="relative space-y-1 text-xs">
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-950" />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {h.status_anterior && (
                                <span className="text-slate-500 line-through text-[11px]">
                                  {STATUS_CONFIG[h.status_anterior]?.label || h.status_anterior}
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${newStatusCfg?.className || ""}`}>
                                {newStatusCfg?.label || h.status_novo}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          {h.observacao && (
                            <p className="text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800 text-[11px] italic">
                              "{h.observacao}"
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                {action.status === "PENDENTE" && (
                  <button
                    onClick={handleStartAction}
                    disabled={submitting}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Iniciar Ação
                  </button>
                )}

                {action.status === "EM_ANDAMENTO" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveModal("CONCLUIR")}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir
                    </button>
                    <button
                      onClick={() => setActiveModal("NAO_EFETIVA")}
                      className="py-2.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 font-bold text-xs rounded-xl border border-orange-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Não Efetiva
                    </button>
                  </div>
                )}

                {["PENDENTE", "EM_ANDAMENTO"].includes(action.status) && (
                  <button
                    onClick={() => setActiveModal("CANCELAR")}
                    className="w-full py-2 text-rose-400 hover:text-rose-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelar Ação
                  </button>
                )}

                {isAdmin && ["CONCLUIDA", "NAO_EFETIVA", "CANCELADA"].includes(action.status) && (
                  <button
                    onClick={() => setActiveModal("REABRIR")}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reabrir Ação (Admin)
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ═══ TRANSITION MODALS ═══ */}
      {activeModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 text-slate-100">
            <h3 className="text-base font-bold flex items-center gap-2">
              {activeModal === "CONCLUIR" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {activeModal === "NAO_EFETIVA" && <AlertTriangle className="w-5 h-5 text-orange-400" />}
              {activeModal === "CANCELAR" && <XCircle className="w-5 h-5 text-rose-400" />}
              {activeModal === "REABRIR" && <RotateCcw className="w-5 h-5 text-blue-400" />}
              {activeModal === "CONCLUIR" && "Concluir Ação de Follow-up"}
              {activeModal === "NAO_EFETIVA" && "Marcar Ação como Não Efetiva"}
              {activeModal === "CANCELAR" && "Cancelar Ação de Follow-up"}
              {activeModal === "REABRIR" && "Reabrir Ação de Follow-up"}
            </h3>

            {modalError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg font-semibold">
                {modalError}
              </div>
            )}

            {activeModal === "CONCLUIR" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Resultado Obtido</label>
                  <textarea
                    value={resultadoInput}
                    onChange={(e) => setResultadoInput(e.target.value)}
                    placeholder="Descreva detalhadamente o resultado alcançado..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {activeModal === "NAO_EFETIVA" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Motivo da Não Efetividade</label>
                  <textarea
                    value={motivoCancelamentoInput}
                    onChange={(e) => setMotivoCancelamentoInput(e.target.value)}
                    placeholder="Explique por que a ação não alcançou o objetivo esperado..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {activeModal === "CANCELAR" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Motivo do Cancelamento</label>
                  <textarea
                    value={motivoCancelamentoInput}
                    onChange={(e) => setMotivoCancelamentoInput(e.target.value)}
                    placeholder="Motivo pelo qual a ação está sendo cancelada..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {activeModal === "REABRIR" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Justificativa da Reabertura</label>
                  <textarea
                    value={observacaoInput}
                    onChange={(e) => setObservacaoInput(e.target.value)}
                    placeholder="Justifique o motivo pelo qual esta ação está sendo reaberta..."
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                disabled={submitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  if (activeModal === "CONCLUIR") handleStatusTransition("CONCLUIDA");
                  else if (activeModal === "NAO_EFETIVA") handleStatusTransition("NAO_EFETIVA");
                  else if (activeModal === "CANCELAR") handleStatusTransition("CANCELADA");
                  else if (activeModal === "REABRIR") handleStatusTransition("EM_ANDAMENTO");
                }}
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
