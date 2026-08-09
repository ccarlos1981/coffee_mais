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
} from "lucide-react";
import type { FollowUpActionRecord, FollowUpHistoryRecord, FollowUpStatus } from "@/lib/services/follow-up-service";

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

export function FollowUpDrawer({ actionId, onClose, onActionUpdated, userRole }: FollowUpDrawerProps) {
  const [action, setAction] = useState<FollowUpActionRecord | null>(null);
  const [history, setHistory] = useState<FollowUpHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal State
  const [activeModal, setActiveModal] = useState<'CONCLUIR' | 'NAO_EFETIVA' | 'CANCELAR' | 'REABRIR' | null>(null);
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

  const statusCfg = action ? STATUS_CONFIG[action.status] : null;
  const prioCfg = action ? (PRIORIDADE_CONFIG[action.prioridade] || PRIORIDADE_CONFIG.MEDIA) : null;
  const StatusIcon = statusCfg?.icon;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 transition-opacity" onClick={onClose} />

      {/* Main Drawer Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[520px] md:w-[580px] bg-background border-l border-border z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-foreground">Detalhamento do Follow-up</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted/20 transition-colors text-muted hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <span className="text-xs font-semibold text-muted tracking-widest uppercase animate-pulse">
                Carregando detalhes...
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
              <div className="bg-muted/5 border border-border/60 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-foreground">{action.cliente_nome}</h3>
                    {action.rede && (
                      <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
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
                    {action.is_atrasada && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border bg-rose-500/20 text-rose-400 border-rose-500/40">
                        <Clock className="w-3.5 h-3.5" />
                        ATRASADA
                      </span>
                    )}
                    {prioCfg && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${prioCfg.className}`}>
                        {prioCfg.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-2 text-muted">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>Gerente: <strong className="text-foreground">{action.manager_name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-muted">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <span>Prazo: <strong className="text-foreground">{new Date(action.prazo).toLocaleDateString("pt-BR")}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Informações da Ação
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/5 border border-border/40 rounded-lg p-3">
                    <div className="text-[10px] text-muted font-semibold uppercase">Origem</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">
                      {ORIGEM_LABELS[action.origem] || action.origem}
                    </div>
                    {action.origem_ref && (
                      <div className="text-[10px] text-muted truncate mt-0.5">Ref: {action.origem_ref}</div>
                    )}
                  </div>

                  <div className="bg-muted/5 border border-border/40 rounded-lg p-3">
                    <div className="text-[10px] text-muted font-semibold uppercase">Tipo de Ação</div>
                    <div className="text-xs font-bold text-foreground mt-0.5">
                      {TIPO_LABELS[action.tipo_acao] || action.tipo_acao}
                    </div>
                  </div>
                </div>

                <div className="bg-muted/5 border border-border/40 rounded-lg p-3 space-y-1">
                  <div className="text-[10px] text-muted font-semibold uppercase">Motivo / Diagnóstico</div>
                  <p className="text-xs text-foreground font-medium leading-relaxed">{action.motivo}</p>
                </div>

                {action.descricao && (
                  <div className="bg-muted/5 border border-border/40 rounded-lg p-3 space-y-1">
                    <div className="text-[10px] text-muted font-semibold uppercase">Descrição detalhada</div>
                    <p className="text-xs text-muted leading-relaxed whitespace-pre-line">{action.descricao}</p>
                  </div>
                )}
              </div>

              {/* Results (if available) */}
              {(action.resultado || action.motivo_cancelamento) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Resultado & Conclusão
                  </h4>

                  {action.resultado && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] text-emerald-400 font-semibold uppercase">Resultado da Ação</div>
                      <p className="text-xs text-foreground font-medium">{action.resultado}</p>
                    </div>
                  )}

                  {action.motivo_cancelamento && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 space-y-1">
                      <div className="text-[10px] text-rose-400 font-semibold uppercase">Motivo do Cancelamento / Não Efetividade</div>
                      <p className="text-xs text-foreground font-medium">{action.motivo_cancelamento}</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Histórico de Transições ({history.length})
                </h4>

                <div className="space-y-2 border-l-2 border-border/60 ml-2 pl-4 py-1">
                  {history.length === 0 ? (
                    <p className="text-xs text-muted italic">Nenhuma transição de histórico registrada.</p>
                  ) : (
                    history.map((h) => {
                      const newStatusCfg = STATUS_CONFIG[h.status_novo];
                      return (
                        <div key={h.id} className="relative space-y-1 text-xs">
                          <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border border-background" />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {h.status_anterior && (
                                <span className="text-muted line-through text-[11px]">{STATUS_CONFIG[h.status_anterior]?.label || h.status_anterior}</span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${newStatusCfg?.className || ''}`}>
                                {newStatusCfg?.label || h.status_novo}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          {h.observacao && (
                            <p className="text-muted bg-muted/5 p-2 rounded border border-border/30 text-[11px] italic">
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
              <div className="pt-4 border-t border-border space-y-2">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Ações Disponíveis</div>

                <div className="flex flex-wrap items-center gap-2">
                  {action.status === "PENDENTE" && (
                    <>
                      <button
                        onClick={handleStartAction}
                        className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Iniciar Ação
                      </button>
                      <button
                        onClick={() => setActiveModal("CANCELAR")}
                        className="py-2.5 px-4 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/30 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                    </>
                  )}

                  {action.status === "EM_ANDAMENTO" && (
                    <>
                      <button
                        onClick={() => setActiveModal("CONCLUIR")}
                        className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Concluir Ação
                      </button>
                      <button
                        onClick={() => setActiveModal("NAO_EFETIVA")}
                        className="py-2.5 px-3 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Não Efetiva
                      </button>
                      <button
                        onClick={() => setActiveModal("CANCELAR")}
                        className="py-2.5 px-3 bg-slate-500/15 hover:bg-slate-500/25 text-slate-400 border border-slate-500/30 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                    </>
                  )}

                  {(action.status === "CONCLUIDA" || action.status === "NAO_EFETIVA") && isAdmin && (
                    <button
                      onClick={() => setActiveModal("REABRIR")}
                      className="w-full py-2.5 px-4 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reabrir Ação (Admin)
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Status Transition Modals */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              {activeModal === "CONCLUIR" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {activeModal === "NAO_EFETIVA" && <AlertTriangle className="w-5 h-5 text-orange-400" />}
              {activeModal === "CANCELAR" && <XCircle className="w-5 h-5 text-rose-400" />}
              {activeModal === "REABRIR" && <RotateCcw className="w-5 h-5 text-blue-400" />}

              {activeModal === "CONCLUIR" && "Concluir Follow-up"}
              {activeModal === "NAO_EFETIVA" && "Marcar como Não Efetiva"}
              {activeModal === "CANCELAR" && "Cancelar Follow-up"}
              {activeModal === "REABRIR" && "Reabrir Follow-up"}
            </h3>

            {modalError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400">
                {modalError}
              </div>
            )}

            {(activeModal === "CONCLUIR" || activeModal === "NAO_EFETIVA") && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Resultado da Ação *</label>
                <textarea
                  value={resultadoInput}
                  onChange={(e) => setResultadoInput(e.target.value)}
                  placeholder="Descreva o resultado obtido na negociação ou contato..."
                  rows={3}
                  className="w-full bg-muted/10 border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {(activeModal === "NAO_EFETIVA" || activeModal === "CANCELAR") && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Motivo do Cancelamento / Não Efetividade *</label>
                <textarea
                  value={motivoCancelamentoInput}
                  onChange={(e) => setMotivoCancelamentoInput(e.target.value)}
                  placeholder="Explique o motivo do cancelamento ou por que a ação não foi efetiva..."
                  rows={3}
                  className="w-full bg-muted/10 border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted">Observação adicional (opcional)</label>
              <input
                type="text"
                value={observacaoInput}
                onChange={(e) => setObservacaoInput(e.target.value)}
                placeholder="Observação para registro na timeline..."
                className="w-full bg-muted/10 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                disabled={submitting}
                className="px-4 py-2 bg-muted/20 hover:bg-muted/30 text-xs font-semibold text-foreground rounded-lg transition-colors"
              >
                Cancelar
              </button>

              <button
                onClick={() => {
                  if (activeModal === "CONCLUIR") handleStatusTransition("CONCLUIDA");
                  else if (activeModal === "NAO_EFETIVA") handleStatusTransition("NAO_EFETIVA");
                  else if (activeModal === "CANCELAR") handleStatusTransition("CANCELADA");
                  else if (activeModal === "REABRIR") handleStatusTransition("EM_ANDAMENTO");
                }}
                disabled={submitting}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-lg shadow transition-colors flex items-center gap-1.5"
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
