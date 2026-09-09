"use client";

import React from "react";
import {
  AlertTriangle,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  X,
  Clock,
  Layers,
  Loader2,
  Lock,
  Info,
  Calendar,
  DollarSign,
  Building2,
  FileText
} from "lucide-react";

export type DiagnosticoExclusao =
  | "CLEAN"
  | "FUTURE_ONLY"
  | "PARTIAL_REALIZED"
  | "FULLY_REALIZED"
  | "MULTI_ACTION_FINANCIAL_AMBIGUOUS";

export interface ExcluirAcaoItem {
  id: string;
  rede: string;
  tipo_acao?: string | null;
  familia_produto?: string | null;
  fase_atual?: number | null;
  valor_investimento?: number | null;
  is_test?: boolean | null;
  financeiro_pago_em?: string | null;
  possui_dependencia_financeira?: boolean | null;
  codigo_campanha?: string | null;
  nome_campanha?: string | null;

  // Novos campos diagnósticos (Gate 5.16 Fase 3)
  diagnostico_exclusao?: DiagnosticoExclusao | null;
  motivo_bloqueio_exclusao?: string | null;
  elegivel_exclusao_admin?: boolean | null;
  parcelas_futuras_count?: number | null;
  parcelas_pagas_count?: number | null;
  boletos_pagos_count?: number | null;
  boletos_abertos_count?: number | null;
  pagamentos_realizados_count?: number | null;
  outras_acoes_ativas_count?: number | null;
  total_acoes_historicas_count?: number | null;
}

export interface ExcluirAcaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  action: ExcluirAcaoItem | null;
  isLoading?: boolean;
  tipoEntidadeLabel?: string; // "ação comercial" ou "planejamento"
}

const formatCurrency = (val: number | null | undefined): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
};

export function ExcluirAcaoModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  isLoading = false,
  tipoEntidadeLabel = "ação comercial",
}: ExcluirAcaoModalProps) {
  if (!isOpen || !action) return null;

  // Determinação determinística do estado diagnóstico
  const diagnostico: DiagnosticoExclusao = (() => {
    if (action.diagnostico_exclusao) {
      return action.diagnostico_exclusao;
    }
    // Fallbacks canônicos de segurança
    if (action.outras_acoes_ativas_count && action.outras_acoes_ativas_count > 0 && (action.parcelas_futuras_count || action.parcelas_pagas_count)) {
      return "MULTI_ACTION_FINANCIAL_AMBIGUOUS";
    }
    if (action.financeiro_pago_em || (action.boletos_pagos_count && action.boletos_pagos_count > 0) || (action.parcelas_pagas_count && action.parcelas_pagas_count > 0 && !action.parcelas_futuras_count)) {
      return "FULLY_REALIZED";
    }
    if (action.parcelas_pagas_count && action.parcelas_pagas_count > 0 && action.parcelas_futuras_count && action.parcelas_futuras_count > 0) {
      return "PARTIAL_REALIZED";
    }
    if (action.parcelas_futuras_count && action.parcelas_futuras_count > 0) {
      return "FUTURE_ONLY";
    }
    if (action.possui_dependencia_financeira) {
      return "FULLY_REALIZED";
    }
    return "CLEAN";
  })();

  const isTest = action.is_test === true;
  // REGRA DE VALOR: valor_investimento = TOTAL (nunca multiplicar por volume)
  const valorTotal = action.valor_investimento || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Faixa decorativa superior contextual */}
        <div 
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            diagnostico === "CLEAN" 
              ? isTest ? "bg-amber-500" : "bg-emerald-500"
              : diagnostico === "FUTURE_ONLY"
              ? "bg-amber-500"
              : diagnostico === "PARTIAL_REALIZED"
              ? "bg-orange-500"
              : "bg-red-600"
          }`} 
        />

        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl border ${
              diagnostico === "CLEAN"
                ? isTest 
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400" 
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : diagnostico === "FUTURE_ONLY"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : diagnostico === "PARTIAL_REALIZED"
                ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                : "bg-red-500/15 border-red-500/30 text-red-400"
            }`}>
              {diagnostico === "CLEAN" ? (
                isTest ? <AlertTriangle className="w-6 h-6 text-amber-400" /> : <Trash2 className="w-6 h-6 text-emerald-400" />
              ) : diagnostico === "FUTURE_ONLY" ? (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              ) : diagnostico === "PARTIAL_REALIZED" ? (
                <Clock className="w-6 h-6 text-orange-400" />
              ) : diagnostico === "MULTI_ACTION_FINANCIAL_AMBIGUOUS" ? (
                <Layers className="w-6 h-6 text-red-400" />
              ) : (
                <Lock className="w-6 h-6 text-red-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">
                  {diagnostico === "CLEAN" && (
                    isTest ? `Excluir ${tipoEntidadeLabel} de teste?` : `Excluir ${tipoEntidadeLabel}?`
                  )}
                  {diagnostico === "FUTURE_ONLY" && (
                    `Excluir ${tipoEntidadeLabel} com compromisso futuro?`
                  )}
                  {diagnostico === "PARTIAL_REALIZED" && (
                    `Encerrar ${tipoEntidadeLabel} (Amortização Parcial)?`
                  )}
                  {diagnostico === "FULLY_REALIZED" && (
                    "Exclusão Bloqueada — Financial Guard"
                  )}
                  {diagnostico === "MULTI_ACTION_FINANCIAL_AMBIGUOUS" && (
                    "Exclusão Bloqueada — Negociação Multi-Ações"
                  )}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-2">
                <span>{action.rede}</span>
                <span>•</span>
                <span>Fase {action.fase_atual || 1}</span>
                {isTest && (
                  <>
                    <span>•</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px]">TESTE</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Resumo da Ação (Preservando valor_investimento = TOTAL) */}
        <div className="bg-muted/30 p-3.5 rounded-xl border border-border/70 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Rede:
            </span>
            <span className="font-semibold text-foreground">{action.rede}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Tipo / Família:
            </span>
            <span className="font-semibold text-foreground">
              {action.tipo_acao || action.familia_produto || "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Valor do Investimento (Total):
            </span>
            <span className="font-bold text-amber-400 font-mono">
              {formatCurrency(valorTotal)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-border/50 text-[11px]">
            <span className="text-muted-foreground">ID da Ação:</span>
            <span className="font-mono text-muted-foreground">{action.id}</span>
          </div>
        </div>

        {/* Painel Contextual por Estado Diagnóstico */}
        {diagnostico === "CLEAN" && (
          <div className="space-y-2 text-xs text-muted-foreground bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/30">
            <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Sem dependências financeiras
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {isTest
                ? "Este registro está identificado como homologação/teste e será removido definitivamente do banco de dados."
                : `Esta ${tipoEntidadeLabel} não possui parcelas, boletos nem pagamentos atrelados. A exclusão física removerá o registro definitivamente.`}
            </p>
            <p className="text-emerald-300 font-medium pt-1">
              Confirma a exclusão definitiva?
            </p>
          </div>
        )}

        {diagnostico === "FUTURE_ONLY" && (
          <div className="space-y-3 text-xs bg-amber-950/30 p-4 rounded-xl border border-amber-500/40 text-amber-200/90">
            <p className="font-bold text-amber-400 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Compromissos Financeiros Futuros Identificados
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Esta {tipoEntidadeLabel} possui compromissos financeiros futuros cadastrados que ainda <strong>não tiveram qualquer pagamento realizado</strong>:
            </p>

            <ul className="space-y-1.5 pl-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  <strong>{action.parcelas_futuras_count || 1} parcela(s) futura(s) pendente(s)</strong> serão canceladas com status canônico <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground">CANCELADA_EXCLUSAO_ACAO</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  A {tipoEntidadeLabel} será <strong>excluída fisicamente</strong> do sistema e os saldos da negociação serão recalculados.
                </span>
              </li>
              {(action.boletos_abertos_count || 0) > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    Boletos em aberto terão apenas o vínculo desfeito localmente, preservando o documento para o setor Financeiro.
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span className="text-emerald-300/90">
                  Nenhum valor financeiro realizado/confirmado será apagado ou corrompido.
                </span>
              </li>
            </ul>

            <p className="text-amber-300 font-semibold pt-1">
              Deseja cancelar os compromissos futuros e excluir a {tipoEntidadeLabel}?
            </p>
          </div>
        )}

        {diagnostico === "PARTIAL_REALIZED" && (
          <div className="space-y-3 text-xs bg-orange-950/30 p-4 rounded-xl border border-orange-500/40 text-orange-200/90">
            <p className="font-bold text-orange-400 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-orange-400" />
              Histórico Financeiro Parcialmente Realizado
            </p>
            <p className="leading-relaxed text-muted-foreground">
              Esta {tipoEntidadeLabel} já possui pagamentos ou amortizações parciais realizadas:
            </p>

            <ul className="space-y-1.5 pl-1 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>
                  O histórico de <strong>{action.parcelas_pagas_count || 1} pagamento(s) realizado(s)</strong> será estritamente preservado para auditoria fiscal.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">•</span>
                <span>
                  O saldo futuro remanescente de parcelas pendentes será cancelado.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-400 font-bold">•</span>
                <span>
                  <strong>Não haverá exclusão física (DELETE)</strong>: a ação será encerrada via cancelamento administrativo rastreável.
                </span>
              </li>
            </ul>

            <p className="text-orange-300 font-semibold pt-1">
              Deseja confirmar o encerramento administrativo da {tipoEntidadeLabel}?
            </p>
          </div>
        )}

        {diagnostico === "FULLY_REALIZED" && (
          <div className="space-y-3 text-xs bg-red-950/40 p-4 rounded-xl border border-red-500/40 text-red-200/90">
            <p className="font-bold text-red-400 flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Exclusão Bloqueada — Realização Financeira Integral
            </p>
            <p className="leading-relaxed text-red-200/80">
              Esta {tipoEntidadeLabel} possui liquidação financeira integral, quitação de parcelas ou pagamentos baixados no setor Financeiro.
            </p>
            <div className="bg-red-900/30 p-2.5 rounded-lg border border-red-500/20 text-[11px] space-y-1">
              <p className="font-semibold text-red-300">Preservação Contábil Obrigatória:</p>
              <p className="text-red-200/70">
                O Financial Guard impede a exclusão física ou cancelamento para garantir a conciliação bancária, relatórios fiscais e conformidade contábil.
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Caso seja necessário ajuste retroativo, solicite estorno ao departamento Financeiro.
            </p>
          </div>
        )}

        {diagnostico === "MULTI_ACTION_FINANCIAL_AMBIGUOUS" && (
          <div className="space-y-3 text-xs bg-red-950/40 p-4 rounded-xl border border-red-500/40 text-red-200/90">
            <p className="font-bold text-red-400 flex items-center gap-2 text-sm">
              <Layers className="w-4 h-4 text-red-400" />
              Exclusão Bloqueada — Governança Multi-Ação (Opção A)
            </p>
            <p className="leading-relaxed text-red-200/80">
              Esta ação pertence a uma negociação master com <strong>{action.outras_acoes_ativas_count || "múltiplas"} outras ações ativas</strong> e plano financeiro compartilhado.
            </p>
            <div className="bg-red-900/30 p-2.5 rounded-lg border border-red-500/20 text-[11px] space-y-1.5">
              <p className="font-semibold text-red-300">Regra Anti-Ambiguidade:</p>
              <p className="text-red-200/70">
                O sistema proíbe rateios arbitrários, amortizações proporcionais ou cancelamentos automáticos que possam comprometer as demais ações da negociação.
              </p>
              <p className="text-amber-300/90 font-medium">
                Solução: Ajuste as parcelas na negociação consolidada antes de excluir uma ação individual.
              </p>
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/70 rounded-xl transition-colors disabled:opacity-50"
          >
            {diagnostico === "FULLY_REALIZED" || diagnostico === "MULTI_ACTION_FINANCIAL_AMBIGUOUS"
              ? "Entendido / Fechar"
              : "Cancelar"}
          </button>

          {/* Botão de confirmação apenas quando elegível */}
          {(diagnostico === "CLEAN" || diagnostico === "FUTURE_ONLY" || diagnostico === "PARTIAL_REALIZED") && (
            <button
              type="button"
              onClick={() => onConfirm()}
              disabled={isLoading}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                diagnostico === "CLEAN"
                  ? isTest
                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/30"
                    : "bg-red-600 hover:bg-red-500 shadow-red-950/30"
                  : diagnostico === "FUTURE_ONLY"
                  ? "bg-amber-600 hover:bg-amber-500 shadow-amber-950/30"
                  : "bg-orange-600 hover:bg-orange-500 shadow-orange-950/30"
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  {diagnostico === "CLEAN" && (
                    isTest ? (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>Excluir registro de teste</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Confirmar exclusão</span>
                      </>
                    )
                  )}
                  {diagnostico === "FUTURE_ONLY" && (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Cancelar compromissos e excluir</span>
                    </>
                  )}
                  {diagnostico === "PARTIAL_REALIZED" && (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Confirmar encerramento</span>
                    </>
                  )}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
