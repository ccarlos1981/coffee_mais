"use client";

import React from "react";
import { ShieldCheck, AlertCircle, FileCheck, Clock, FileX, HelpCircle, Loader2 } from "lucide-react";
import type { ClientFarolSummary } from "@/lib/services/client-farol-service";

interface CrmFarolStatusCardProps {
  farol: ClientFarolSummary | null;
  loading: boolean;
  error?: string | null;
}

export const CrmFarolStatusCard: React.FC<CrmFarolStatusCardProps> = ({ farol, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-background/60 border border-border/70 rounded-2xl p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-gold" />
        <span>Consultando Farol Comercial & Financeiro...</span>
      </div>
    );
  }

  if (error || !farol) {
    return (
      <div className="bg-background/40 border border-border/50 rounded-2xl p-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          Farol Comercial & Financeiro indisponível
        </span>
        <span className="text-[10px] text-muted-foreground/80">Verifique os códigos do cliente</span>
      </div>
    );
  }

  const { adimplencia, cartaAnuencia } = farol;

  // Render Adimplência Badge
  const renderAdimplencia = () => {
    switch (adimplencia.status) {
      case "EM_DIA":
        return (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="leading-tight">Financeiro Em Dia</div>
              <div className="text-[10px] font-normal text-emerald-500/80">0 títulos vencidos</div>
            </div>
          </div>
        );
      case "INADIMPLENTE":
        return (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-xl text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <div className="leading-tight font-bold">Inadimplência Identificada</div>
              <div className="text-[10px] font-normal text-rose-300">
                {adimplencia.titulosVencidosCount} {adimplencia.titulosVencidosCount === 1 ? "título vencido" : "títulos vencidos"} (atraso máx: {adimplencia.maiorAtrasoDias}d)
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 bg-muted/40 border border-border text-muted-foreground px-3 py-2 rounded-xl text-xs">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <div>
              <div className="leading-tight font-medium">Boletos: Sem Chave ERP</div>
              <div className="text-[10px] text-muted-foreground">Código parceiro não vinculado</div>
            </div>
          </div>
        );
    }
  };

  // Render Carta de Anuência Badge
  const renderCartaAnuencia = () => {
    switch (cartaAnuencia.status) {
      case "VIGENTE":
        return (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-2 rounded-xl text-xs font-semibold">
            <FileCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <div className="leading-tight">Carta Vigente ({cartaAnuencia.competencia || "Ano"})</div>
              <div className="text-[10px] font-normal text-emerald-500/80">
                {cartaAnuencia.diasParaExpirar !== null && cartaAnuencia.diasParaExpirar > 0
                  ? `Válida por mais ${cartaAnuencia.diasParaExpirar} dias`
                  : "Acordo comercial assinado"}
              </div>
            </div>
          </div>
        );
      case "PENDENTE":
        return (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-xl text-xs font-semibold">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <div className="leading-tight">Carta em Tramitação</div>
              <div className="text-[10px] font-normal text-amber-300">Pendente de assinatura</div>
            </div>
          </div>
        );
      case "EXPIRADA":
        return (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-xl text-xs font-semibold">
            <FileX className="w-4 h-4 text-rose-500 shrink-0" />
            <div>
              <div className="leading-tight font-bold">Carta Expirada</div>
              <div className="text-[10px] font-normal text-rose-300">Acordo comercial vencido</div>
            </div>
          </div>
        );
      case "SEM_CARTA":
        return (
          <div className="flex items-center gap-2 bg-muted/40 border border-border text-muted-foreground px-3 py-2 rounded-xl text-xs">
            <FileX className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="leading-tight font-medium">Sem Carta Cadastrada</div>
              <div className="text-[10px] text-muted-foreground">Acordo anual não localizado</div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 bg-muted/40 border border-border text-muted-foreground px-3 py-2 rounded-xl text-xs">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <div>
              <div className="leading-tight font-medium">Carta: Sem Chave</div>
              <div className="text-[10px] text-muted-foreground">Rede não identificada</div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
          Farol Comercial & Financeiro
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">
          On-Demand Check
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {renderAdimplencia()}
        {renderCartaAnuencia()}
      </div>
    </div>
  );
};
