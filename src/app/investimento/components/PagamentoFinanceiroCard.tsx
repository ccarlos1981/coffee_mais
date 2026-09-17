"use client";

import React from "react";
import { Banknote, CheckCircle, RefreshCw, FileText, Calendar, User } from "lucide-react";

export interface PagamentoFinanceiroCardProps {
  action: {
    id: string;
    fase_atual?: number;
    financeiro_pago_em?: string | null;
    financeiro_pago_por?: string | null;
    financeiro_comprovante_url?: string | null;
    financeiro_observacoes?: string | null;
  };
  isPhase5: boolean;
  isPhase6: boolean;
  onConfirmarPagamento: (formData: FormData) => Promise<void>;
  actionLoading: boolean;
  userRole?: string | null;
  onViewDocument: (filePath: string) => void;
}

function formatDatePtBr(isoString?: string | null): string {
  if (!isoString) return "Não informada";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Não informada";
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "Não informada";
  }
}

export function PagamentoFinanceiroCard({
  action,
  isPhase5,
  isPhase6,
  onConfirmarPagamento,
  actionLoading,
  userRole,
  onViewDocument,
}: PagamentoFinanceiroCardProps) {
  const isAuthorized = ["Financeiro", "Admin", "Admin Master", "CEO", "Trade"].includes(userRole || "");

  // MODO FASE 5: Formulário Operacional de Finalização Financeira
  if (isPhase5) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          await onConfirmarPagamento(formData);
        }}
        className="bg-elevated p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 shadow-sm flex flex-col gap-3"
      >
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Banknote className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block leading-tight">Finalizar Financeiro</span>
              <span className="text-[10px] text-muted block leading-tight">Liquidação e confirmação de pagamento</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Fase 5 — Pagamento Pendente
          </span>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Observações Financeiras (Opcional)</label>
          <textarea
            name="financeiro_observacoes"
            rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y"
            placeholder="Detalhes do pagamento, número de transação, lote contábil, etc."
          />
        </div>

        <button
          type="submit"
          disabled={actionLoading || !isAuthorized}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 cursor-pointer"
          title={!isAuthorized ? "Apenas perfil Financeiro ou Trade pode finalizar" : ""}
        >
          {actionLoading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Banknote className="w-4 h-4" />
          )}
          Confirmar Pagamento
        </button>
      </form>
    );
  }

  // MODO FASE 6: Resumo Histórico do Pagamento Realizado
  if (isPhase6) {
    const dataPagamento = formatDatePtBr(action.financeiro_pago_em);
    const responsavel = action.financeiro_pago_por || "Não informado";
    const observacoes = action.financeiro_observacoes ? action.financeiro_observacoes.trim() : null;

    return (
      <div className="bg-elevated p-3.5 sm:p-4 rounded-xl border border-emerald-500/25 shadow-sm flex flex-col gap-3">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-foreground block leading-tight">Pagamento Financeiro</span>
              <span className="text-[10px] text-muted block leading-tight">Liquidação contábil e confirmação de pagamento</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Pago / Concluído
          </span>
        </div>

        {/* Grid de Informações do Pagamento */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted" /> Data do Pagamento
            </span>
            <span className="text-xs font-bold text-emerald-400 mt-0.5">
              {dataPagamento}
            </span>
          </div>

          <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3 text-muted" /> Confirmado Por
            </span>
            <span className="text-xs font-medium text-foreground mt-0.5 truncate" title={responsavel}>
              {responsavel}
            </span>
          </div>
        </div>

        {/* Observações Financeiras se houver */}
        {observacoes && (
          <div className="p-2.5 bg-background border border-border rounded-lg text-xs space-y-1">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Observações Financeiras:</span>
            <p className="text-foreground/90 italic text-xs leading-relaxed whitespace-pre-wrap">
              &quot;{observacoes}&quot;
            </p>
          </div>
        )}

        {/* Comprovante de Pagamento Anexado */}
        {action.financeiro_comprovante_url && (
          <div className="flex items-center justify-between p-2 bg-background border border-border rounded-lg">
            <div className="flex items-center gap-2 truncate">
              <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-medium text-foreground truncate">Comprovante de Pagamento</span>
            </div>
            <button
              type="button"
              onClick={() => onViewDocument(action.financeiro_comprovante_url!)}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 underline flex-shrink-0 ml-2"
            >
              Visualizar
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
