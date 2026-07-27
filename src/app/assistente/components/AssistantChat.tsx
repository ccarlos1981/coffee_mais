"use client";

import React, { useState } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { AssistantMessage } from "@/lib/governance/analytics/assistant";
import { AssistantKpis } from "./AssistantKpis";

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
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 flex flex-col h-[550px]">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Conversa Executiva em Linguagem Natural</h3>
            <p className="text-[11px] text-muted-foreground">Respostas determinísticas geradas pelos motores analíticos oficiais</p>
          </div>
        </div>
      </div>

      {/* Área de Mensagens Scrollável */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 text-xs ${
              msg.sender === "USER" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.sender === "ASSISTANT" && (
              <div className="w-7 h-7 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl p-4 space-y-2 ${
                msg.sender === "USER"
                  ? "bg-gold text-stone-900 font-medium rounded-tr-none"
                  : "bg-background border border-border text-foreground rounded-tl-none"
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-[10px] opacity-75">
                <span className="font-bold">{msg.sender === "USER" ? "Você" : "Assistente Comercial IA"}</span>
                <span>{msg.timestamp}</span>
              </div>

              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

              {msg.dataInsight?.kpis && <AssistantKpis kpis={msg.dataInsight.kpis} />}
            </div>

            {msg.sender === "USER" && (
              <div className="w-7 h-7 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 text-xs justify-start">
            <div className="w-7 h-7 rounded-xl bg-gold/10 text-gold flex items-center justify-center shrink-0 border border-gold/20">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-background border border-border p-3 rounded-2xl rounded-tl-none text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-gold animate-pulse" />
              <span>Consultando motores analíticos homologados...</span>
            </div>
          </div>
        )}
      </div>

      {/* Sugestões de Pergunta Sequencial (Follow-Ups) */}
      {suggestedFollowUps.length > 0 && !loading && (
        <div className="flex items-center gap-2 pt-2 overflow-x-auto text-[11px]">
          <span className="text-muted-foreground font-semibold shrink-0">Seguir com:</span>
          {suggestedFollowUps.map((fu, idx) => (
            <button
              key={idx}
              onClick={() => onFollowUp(fu)}
              className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border transition-all whitespace-nowrap"
            >
              👉 {fu}
            </button>
          ))}
        </div>
      )}

      {/* Input de Mensagem */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-border">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Pergunte sobre faturamento, forecast, DRE, CRM ou simulação..."
          disabled={loading}
          className="flex-1 h-10 px-4 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="px-4 h-10 bg-gold hover:bg-gold-hover text-stone-900 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          Enviar
        </button>
      </form>
    </div>
  );
};
