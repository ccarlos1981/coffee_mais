"use client";

import React from "react";
import { X, ShieldCheck, Bot } from "lucide-react";
import { AssistantMessage } from "@/lib/governance/analytics/assistant";

interface AssistantDrawerProps {
  message: AssistantMessage | null;
  onClose: () => void;
}

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
      <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto space-y-6">
        <div className="space-y-6">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-gold/10 text-gold text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-gold/20">
                  ASSISTANTE IA ID #{message.id}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  {message.category || "GERAL"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                Detalhamento da Resposta Analítica
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

          <div className="bg-background border border-border rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-gold" />
              Resposta em Linguagem Natural
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {message.text}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Assistente Comercial: Apuração 100% isolada e read-only.</span>
          </div>
        </div>

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
