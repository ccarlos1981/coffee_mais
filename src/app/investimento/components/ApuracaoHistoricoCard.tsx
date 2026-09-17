"use client";

import React from "react";
import {
  FileSpreadsheet,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  Paperclip,
  ExternalLink,
} from "lucide-react";

export interface ApuracaoHistoricoCardProps {
  action: {
    id: string;
    apuracao_numero_acordo?: string | null;
    numero_acordo?: string | null;
    apuracao_qtd_vendida?: number | null;
    volume_vendido_sellout?: number | null;
    apuracao_valor_realizado?: number | null;
    post_action_notes?: string | null;
    apuracao_preenchida_em?: string | null;
    apuracao_preenchida_por?: string | null;
    apuracao_evidencias_url?: string | null;
    evidencias_urls?: string[] | null;
    condicao_pagamento?: string | null;
    sem_boleto?: boolean | null;
  };
  onViewDocument: (filePath: string) => void;
  formatCurrency?: (val: number, showCents?: boolean) => string;
}

function formatDateTimePtBr(isoString?: string | null): string {
  if (!isoString) return "Não informada";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Não informada";
    return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "Não informada";
  }
}

/**
 * Extrai de forma resiliente e retrocompatível todas as evidências da apuração
 * Suporta array nativo de strings, string única, JSON stringificado ou formatos mistos.
 */
function extrairEvidenciasApuracao(action: ApuracaoHistoricoCardProps["action"]): string[] {
  const urls: string[] = [];

  // 1. Verificar evidencias_urls (array nativo de jsonb ou string JSON)
  if (action.evidencias_urls) {
    if (Array.isArray(action.evidencias_urls)) {
      action.evidencias_urls.forEach((item) => {
        if (typeof item === "string" && item.trim()) {
          urls.push(item.trim());
        }
      });
    } else if (typeof action.evidencias_urls === "string") {
      try {
        const parsed = JSON.parse(action.evidencias_urls);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === "string" && item.trim()) urls.push(item.trim());
          });
        } else if (typeof parsed === "string" && parsed.trim()) {
          urls.push(parsed.trim());
        }
      } catch {
        if ((action.evidencias_urls as string).trim()) {
          urls.push((action.evidencias_urls as string).trim());
        }
      }
    }
  }

  // 2. Verificar apuracao_evidencias_url (string única, url direta ou JSON stringificado)
  if (action.apuracao_evidencias_url && typeof action.apuracao_evidencias_url === "string") {
    const raw = action.apuracao_evidencias_url.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            if (typeof item === "string" && item.trim()) urls.push(item.trim());
          });
        } else if (typeof parsed === "string" && parsed.trim()) {
          urls.push(parsed.trim());
        } else {
          urls.push(raw);
        }
      } catch {
        urls.push(raw);
      }
    }
  }

  // Deduplica preservando ordem
  return Array.from(new Set(urls.filter(Boolean)));
}

function getNomeArquivoFormatado(url: string): { nome: string; ext: string } {
  try {
    const raw = url.split("/").pop() || url;
    const ext = raw.split(".").pop()?.toUpperCase() || "ARQUIVO";

    if (raw.startsWith("evidence_")) {
      const parts = raw.split("_");
      if (parts.length >= 5) {
        return { nome: parts.slice(4).join("_"), ext };
      }
    }
    if (raw.includes("_evidencia_")) {
      const parts = raw.split("_evidencia_");
      if (parts.length > 1) {
        return { nome: `Evidência ${parts[1]}`, ext };
      }
    }
    return { nome: raw, ext };
  } catch {
    return { nome: url, ext: "ARQUIVO" };
  }
}

export function ApuracaoHistoricoCard({
  action,
  onViewDocument,
  formatCurrency,
}: ApuracaoHistoricoCardProps) {
  const defaultFormatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const fmt = formatCurrency || defaultFormatCurrency;

  const numeroAcordo = action.apuracao_numero_acordo || action.numero_acordo || "Não informado";

  const volumeReal =
    action.apuracao_qtd_vendida !== null && action.apuracao_qtd_vendida !== undefined
      ? Number(action.apuracao_qtd_vendida).toLocaleString("pt-BR")
      : action.volume_vendido_sellout !== null && action.volume_vendido_sellout !== undefined
      ? Number(action.volume_vendido_sellout).toLocaleString("pt-BR")
      : "Não informado";

  const valorRealizado =
    action.apuracao_valor_realizado !== null && action.apuracao_valor_realizado !== undefined
      ? fmt(Number(action.apuracao_valor_realizado))
      : "Não informado";

  const dataApuracao = formatDateTimePtBr(action.apuracao_preenchida_em);
  const responsavel = action.apuracao_preenchida_por || "Não informado";
  const observacao = action.post_action_notes ? action.post_action_notes.trim() : null;

  const listaEvidencias = extrairEvidenciasApuracao(action);

  return (
    <div className="bg-elevated p-3.5 sm:p-4 rounded-xl border border-purple-500/20 shadow-sm flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground block leading-tight">Apuração do GRV</span>
            <span className="text-[10px] text-muted block leading-tight">Dados consolidados pelo Gerente Regional</span>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Fase 3
        </span>
      </div>

      {/* Grid de Informações Chave */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Número do Acordo</span>
          <span className="text-xs font-mono font-bold text-foreground mt-0.5 break-all">
            {numeroAcordo}
          </span>
        </div>

        <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Volume Real Vendido</span>
          <span className="text-xs font-bold text-foreground mt-0.5">
            {volumeReal !== "Não informado" ? `${volumeReal} un` : volumeReal}
          </span>
        </div>

        <div className="p-2 bg-background border border-border rounded-lg flex flex-col col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Valor Realizado</span>
          <span className="text-sm font-extrabold text-gold mt-0.5">
            {valorRealizado}
          </span>
        </div>

        <div className="p-2 bg-background border border-border rounded-lg flex flex-col">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted" /> Data da Apuração
          </span>
          <span className="text-[11px] font-medium text-foreground mt-0.5">
            {dataApuracao}
          </span>
        </div>

        <div className="p-2 bg-background border border-border rounded-lg flex flex-col col-span-2">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3 text-muted" /> Responsável
          </span>
          <span className="text-[11px] font-medium text-foreground mt-0.5 truncate" title={responsavel}>
            {responsavel}
          </span>
        </div>
      </div>

      {/* Observação do GRV se houver */}
      {observacao && (
        <div className="p-2.5 bg-background border border-border/80 rounded-lg text-xs space-y-1">
          <span className="text-[10px] font-bold text-muted uppercase tracking-wider block">Observação do GRV:</span>
          <p className="text-foreground/90 italic text-xs leading-relaxed whitespace-pre-wrap">
            &quot;{observacao}&quot;
          </p>
        </div>
      )}

      {/* Evidências / Arquivos da Apuração */}
      {listaEvidencias.length > 0 ? (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3 h-3 text-purple-400" />
            {listaEvidencias.length > 1 ? "Evidências / Arquivos da Apuração" : "Evidência / Arquivo da Apuração"}
          </span>
          <div className="space-y-1.5">
            {listaEvidencias.map((url, idx) => {
              const { nome, ext } = getNomeArquivoFormatado(url);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-background border border-border rounded-lg gap-2 hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-purple-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate" title={nome}>
                      {nome}
                    </span>
                    <span className="text-[9px] font-mono text-muted uppercase bg-muted/20 px-1 py-0.5 rounded flex-shrink-0">
                      {ext}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewDocument(url)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline flex-shrink-0 ml-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Visualizar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted italic">
          <Paperclip className="w-3 h-3 text-muted/60 flex-shrink-0" />
          <span>Nenhuma evidência anexada na Apuração.</span>
        </div>
      )}
    </div>
  );
}
