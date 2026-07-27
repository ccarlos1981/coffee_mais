"use client";

import React from "react";
import { X, ShieldCheck, Crown } from "lucide-react";

interface PresidencyDrawerProps {
  item: any | null;
  onClose: () => void;
}

export const PresidencyDrawer: React.FC<PresidencyDrawerProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-gold" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                  PAINEL PRESIDÊNCIA
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                Detalhamento Estratégico Presidencial
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <span className="text-xs font-bold text-foreground block">
              {item.titulo || item.label || "Indicador Presidencial"}
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {item.descricao || item.subtext || "Consolidação de dados homologados do ecossistema Coffee++."}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Consolidação 100% read-only sem alteração de módulos.</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
