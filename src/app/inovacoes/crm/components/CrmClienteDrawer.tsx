"use client";

import React from "react";
import { X, ShieldCheck, Zap, DollarSign, Calendar, User, MapPin, Building, ArrowRight } from "lucide-react";
import { CrmOportunidade } from "@/lib/governance/analytics/engine";

interface CrmClienteDrawerProps {
  oportunidade: CrmOportunidade | null;
  onClose: () => void;
}

export const CrmClienteDrawer: React.FC<CrmClienteDrawerProps> = ({ oportunidade, onClose }) => {
  if (!oportunidade) return null;

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-6">
        <div className="space-y-6">
          {/* Top Header */}
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-gold/10 text-gold text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-gold/20">
                  ID #{oportunidade.clienteId}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {oportunidade.canal} | {oportunidade.uf}
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {oportunidade.clienteNome}
              </h2>
              <p className="text-xs text-muted-foreground">{oportunidade.matrizNome}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Score & Prioridade */}
          <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gold/10 text-gold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Score Oficial</span>
                  <div className="text-xl font-black font-mono text-gold">
                    {oportunidade.scoreImpacto} / 100
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Criticidade</span>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {oportunidade.prioridade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recomendação Prescritiva */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-gold" />
              Ação Prescritiva Sugerida
            </h3>
            <div className="bg-background border border-border rounded-2xl p-4 space-y-2">
              <h4 className="text-sm font-bold text-gold">{oportunidade.titulo}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {oportunidade.descricao}
              </p>
            </div>
          </div>

          {/* Indicadores & Métricas */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Indicadores da Oportunidade
            </h3>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Impacto Est.</span>
                <div className="font-bold text-emerald-500 text-sm">
                  {formatCur(oportunidade.valorImpactoPotencial)}
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Sem Compra</span>
                <div className="font-bold text-foreground text-sm">
                  {oportunidade.diasSemComprar} dias
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Margem MACO</span>
                <div className="font-bold text-foreground text-sm">
                  {oportunidade.margemMacoAtual.toFixed(1)}%
                </div>
              </div>

              <div className="bg-background border border-border rounded-xl p-3 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Gerente</span>
                <div className="font-bold text-foreground text-xs truncate">
                  {oportunidade.gerenteNome}
                </div>
              </div>
            </div>
          </div>

          {/* Aviso Read-Only */}
          <div className="p-3.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Fase 3 Read-Only: As sugestões prescritivas são calculadas 100% via AnalyticsEngine.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
