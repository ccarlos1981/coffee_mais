"use client";

import React from "react";
import {
  Receipt,
  FileText,
  FileUp,
  RefreshCw,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  ShieldCheck,
} from "lucide-react";

export interface VinculoBoletoItem {
  boleto_id: string;
  numero_boleto: string;
  valor_total?: number;
  valor_associado: string | number;
  vencimento?: string;
  tipo_titulo?: string;
  rede?: string;
  status?: string;
}

export interface ConferenciaFinanceiraCardProps {
  action: {
    id: string;
    fase_atual?: number;
    sem_boleto?: boolean | null;
    financeiro_boleto_url?: string | null;
    trade_conferido_em?: string | null;
    trade_conferido_por?: string | null;
    trade_conferencia_aprovado?: boolean | null;
    trade_conferencia_observacao?: string | null;
    approval_comment?: string | null;
  };
  vinculosBoletos: VinculoBoletoItem[];
  isPhase4: boolean;
  uploadingBoletoFinanceiro: boolean;
  onBoletoFinanceiroUpload: (file: File | null) => void;
  onViewDocument: (filePath: string) => void;
  onAprovar: () => void;
  onDevolver: () => void;
  actionLoading: boolean;
  userRole?: string | null;
  formatCurrency?: (val: number, showCents?: boolean) => string;
  formatDate: (dateStr: string) => string;
}

function formatDateTimePtBr(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "-";
  }
}

export function ConferenciaFinanceiraCard({
  action,
  vinculosBoletos,
  isPhase4,
  uploadingBoletoFinanceiro,
  onBoletoFinanceiroUpload,
  onViewDocument,
  onAprovar,
  onDevolver,
  actionLoading,
  userRole,
  formatCurrency,
  formatDate,
}: ConferenciaFinanceiraCardProps) {
  const isAuthorized = ["Financeiro", "Admin", "Admin Master", "CEO", "Trade"].includes(userRole || "");

  const defaultFormatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const fmt = formatCurrency || defaultFormatCurrency;

  const totalAbatimento = vinculosBoletos.reduce((acc, v) => {
    const val = typeof v.valor_associado === "number" ? v.valor_associado : parseFloat(String(v.valor_associado).replace(",", ".")) || 0;
    return acc + val;
  }, 0);

  return (
    <div className="bg-elevated p-3.5 sm:p-4 rounded-xl border border-gold/30 shadow-sm flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-gold/10 rounded-lg text-gold">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground block leading-tight">Conferência Financeira</span>
            <span className="text-[10px] text-muted block leading-tight">Boletos vinculados para abatimento</span>
          </div>
        </div>
        {isPhase4 ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Fase 4 — Em Conferência
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Fase 4 Concluída
          </span>
        )}
      </div>

      {/* Seção de Boletos */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-foreground">
          Nota Fiscal & Boletos de Abatimento
        </span>

        {vinculosBoletos.length > 0 ? (
          <div className="space-y-2">
            {vinculosBoletos.map((vinculo, index) => {
              const valorAssociadoNum = typeof vinculo.valor_associado === "number"
                ? vinculo.valor_associado
                : parseFloat(String(vinculo.valor_associado).replace(",", ".")) || 0;

              return (
                <div
                  key={vinculo.boleto_id || index}
                  className="flex flex-col p-2.5 bg-background border border-border rounded-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-foreground-secondary break-all">
                      {vinculo.rede ? `${vinculo.rede} — ` : ""}Nº {vinculo.numero_boleto}{" "}
                      {vinculo.tipo_titulo ? `[${vinculo.tipo_titulo}]` : ""}
                    </span>
                    {vinculo.status && (
                      <span
                        className={`px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded border ${
                          ["PAGO", "BAIXADO", "QUITADO"].includes(vinculo.status.toUpperCase())
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {vinculo.status}
                      </span>
                    )}
                  </div>

                  {vinculo.valor_total !== undefined && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground/80">
                      <span>
                        Valor Original:{" "}
                        <strong className="text-gold font-bold">
                          {fmt(vinculo.valor_total)}
                        </strong>
                      </span>
                      {vinculo.vencimento && <span className="text-border mx-1">|</span>}
                      {vinculo.vencimento && (
                        <span>
                          Vencimento:{" "}
                          <strong className="text-foreground">
                            {formatDate(vinculo.vencimento)}
                          </strong>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-border/50">
                    <span className="text-[10px] text-muted font-bold uppercase text-left leading-tight block">
                      Valor para<br />abatimento:
                    </span>
                    <span className="text-sm font-extrabold text-gold">
                      {fmt(valorAssociadoNum)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Totalizador quando múltiplos boletos */}
            {vinculosBoletos.length > 1 && (
              <div className="flex items-center justify-between p-2.5 bg-background/80 border border-gold/40 rounded-xl">
                <span className="text-xs font-bold text-foreground">
                  Total para Abatimento ({vinculosBoletos.length} boletos):
                </span>
                <span className="text-sm font-black text-gold">
                  {fmt(totalAbatimento)}
                </span>
              </div>
            )}
          </div>
        ) : action.sem_boleto ? (
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Forma de liquidação: <strong>Sem boleto</strong> (sinalizado que o cliente não possui boletos em aberto).
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted italic">Nenhum boleto em aberto ou vinculado.</span>
        )}
      </div>

      {/* Boleto do Cliente Anexado pelo Financeiro */}
      <div>
        <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wide">
          Boleto do Cliente
        </label>
        {action.financeiro_boleto_url ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg">
            <FileText className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-medium truncate flex-1">
              Boleto Anexado pelo Financeiro
            </span>
            <button
              type="button"
              onClick={() => onViewDocument(action.financeiro_boleto_url!)}
              className="text-xs font-bold underline hover:text-blue-400 flex-shrink-0 ml-2"
            >
              Visualizar
            </button>
          </div>
        ) : isPhase4 ? (
          <label className="flex items-center justify-center gap-2 px-3 py-2 bg-background hover:bg-border border border-dashed border-border rounded-lg cursor-pointer transition-colors group">
            {uploadingBoletoFinanceiro ? (
              <RefreshCw className="w-4 h-4 animate-spin text-muted" />
            ) : (
              <>
                <FileUp className="w-4 h-4 text-muted group-hover:text-blue-400 transition-colors" />
                <span className="text-xs text-muted group-hover:text-foreground font-medium transition-colors">
                  Selecionar arquivo (PDF ou Imagem)...
                </span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept=".pdf,image/*"
              onChange={(e) => onBoletoFinanceiroUpload(e.target.files?.[0] || null)}
              disabled={uploadingBoletoFinanceiro}
            />
          </label>
        ) : (
          <span className="text-xs text-muted italic">Nenhum documento de boleto anexado.</span>
        )}
      </div>

      {/* Histórico de Conferência/Aprovação quando fase >= 5 */}
      {!isPhase4 && (action.trade_conferido_por || action.trade_conferido_em) && (
        <div className="p-2.5 bg-background border border-border rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted font-bold text-[10px] uppercase tracking-wider">
              Conferência Realizada:
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
              <CheckCircle className="w-3.5 h-3.5" /> Aprovada
            </span>
          </div>
          {action.trade_conferido_por && (
            <p className="text-[11px] text-muted">
              Responsável: <strong className="text-foreground">{action.trade_conferido_por}</strong>
            </p>
          )}
          {action.trade_conferido_em && (
            <p className="text-[11px] text-muted">
              Data: <strong className="text-foreground">{formatDateTimePtBr(action.trade_conferido_em)}</strong>
            </p>
          )}
          {(action.trade_conferencia_observacao || action.approval_comment) && (
            <div className="mt-1 pt-1 border-t border-border/50 text-foreground/80 italic text-[11px]">
              &quot;{action.trade_conferencia_observacao || action.approval_comment}&quot;
            </div>
          )}
        </div>
      )}

      {/* Botões Operacionais — EXCLUSIVAMENTE NA FASE 4 */}
      {isPhase4 && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onAprovar}
            disabled={actionLoading || !isAuthorized}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
            title={!isAuthorized ? "Apenas perfil Financeiro ou Trade pode aprovar" : ""}
          >
            {actionLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Aprovar
          </button>
          <button
            type="button"
            onClick={onDevolver}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Devolver
          </button>
        </div>
      )}
    </div>
  );
}
