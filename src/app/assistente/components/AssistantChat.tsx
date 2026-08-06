"use client";

import React, { useState } from "react";
import { Send, Bot, User, Sparkles, RefreshCw } from "lucide-react";
import { AssistantMessage } from "@/lib/governance/analytics/assistant";
import { AssistantDecisionCard } from "./AssistantDecisionCard";

interface AssistantChatProps {
  messages: AssistantMessage[];
  onSendMessage: (text: string) => void;
  onFollowUp: (text: string) => void;
  suggestedFollowUps?: string[];
  loading?: boolean;
}

export const AssistantChat: React.FC<AssistantChatProps> = ({
  messages,
  onSendMessage,
  onFollowUp,
  suggestedFollowUps = [],
  loading = false,
}) => {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col min-h-[600px]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold border border-gold/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Conversa Executiva & Histórico de Sessão</h3>
            <p className="text-[11px] text-muted-foreground">Respostas orquestradas em tempo real com o contrato estrito de 8 seções</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
          100% READ_ONLY
        </span>
      </div>

      {/* Área de Mensagens Scrollável */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 max-h-[700px]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${
              msg.sender === "USER" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender === "ASSISTANT" && (
              <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20 shadow-sm mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`w-full max-w-3xl rounded-2xl p-4 space-y-3 ${
                msg.sender === "USER"
                  ? "bg-gold text-stone-900 font-semibold rounded-tr-none ml-auto max-w-[80%]"
                  : "bg-background border border-border text-foreground rounded-tl-none"
              }`}
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2 text-[10px] opacity-80">
                <span className="font-bold">{msg.sender === "USER" ? "Você" : "Copiloto Executivo Coffee++"}</span>
                <span className="font-mono">{msg.timestamp}</span>
              </div>

              {msg.sender === "USER" ? (
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <AssistantDecisionCard message={msg} />
              )}
            </div>

            {msg.sender === "USER" && (
              <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 shadow-sm mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 text-xs justify-start">
            <div className="w-8 h-8 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20 shadow-sm">
              <Bot className="w-4 h-4 animate-spin text-gold" />
            </div>
            <div className="bg-background border border-border p-4 rounded-2xl rounded-tl-none text-muted-foreground flex items-center gap-3 shadow-sm">
              <Sparkles className="w-4 h-4 text-gold animate-pulse" />
              <span className="font-medium text-foreground">
                Orquestrando AnalyticsEngine, ForecastEngine, SimulationEngine e CommercialIntelligenceEngine...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Sugestões de Pergunta Sequencial (Follow-Ups) */}
      {suggestedFollowUps.length > 0 && !loading && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground font-bold block uppercase tracking-wider">
            Perguntas de Aprofundamento Sugeridas:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedFollowUps.map((text, idx) => (
              <button
                key={idx}
                onClick={() => onFollowUp(text)}
                className="px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-secondary border border-border text-[11px] font-medium text-foreground hover:border-gold transition-all text-left"
              >
                {text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 border-t border-border">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Faça qualquer pergunta executiva em linguagem natural..."
          disabled={loading}
          className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="px-4 py-2.5 bg-gold hover:bg-gold/90 text-stone-900 font-bold rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Enviar</span>
        </button>
      </form>
    </div>
  );
};
