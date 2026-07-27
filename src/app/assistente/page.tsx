"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Bot, ShieldCheck, AlertTriangle } from "lucide-react";
import { AssistantMessage, AssistantResponseData } from "@/lib/governance/analytics/assistant";
import { AssistantFilterBar, AssistantFiltersState } from "./components/AssistantFilterBar";
import { AssistantSuggestedQueries } from "./components/AssistantSuggestedQueries";
import { AssistantChat } from "./components/AssistantChat";
import { AssistantDrawer } from "./components/AssistantDrawer";

export default function AssistenteComercialPage() {
  const defaultFilters: AssistantFiltersState = {
    startMonth: "2026-06",
    endMonth: "2026-06",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const initialMessage: AssistantMessage = {
    id: "msg-welcome",
    sender: "ASSISTANT",
    text: "Olá! Sou o Assistente Comercial da Coffee++. Como posso ajudar com os diagnósticos de faturamento, forecast, DRE, CRM ou simulação comercial?",
    timestamp: "Agora",
    category: "GERAL",
  };

  const [filters, setFilters] = useState<AssistantFiltersState>(defaultFilters);
  const [messages, setMessages] = useState<AssistantMessage[]>([initialMessage]);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<AssistantMessage | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = useCallback(
    async (questionText: string) => {
      if (!questionText.trim()) return;

      const userMsg: AssistantMessage = {
        id: `user-${Date.now()}`,
        sender: "USER",
        text: questionText,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.startMonth) params.set("startMonth", filters.startMonth);
        if (filters.endMonth) params.set("endMonth", filters.endMonth);
        if (filters.manager && filters.manager !== "all") params.set("manager", filters.manager);
        if (filters.uf && filters.uf !== "all") params.set("uf", filters.uf);
        if (filters.channel && filters.channel !== "all") params.set("channel", filters.channel);
        if (filters.matriz && filters.matriz !== "all") params.set("matriz", filters.matriz);

        const res = await fetch(`/api/assistente?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: questionText }),
        });

        if (!res.ok) {
          throw new Error(`Erro na requisição (${res.status})`);
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || "Falha ao obter resposta do Assistente Comercial.");
        }

        const respData: AssistantResponseData = json.data;

        const assistantMsg: AssistantMessage = {
          id: `ast-${Date.now()}`,
          sender: "ASSISTANT",
          text: respData.answer,
          timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          category: respData.category,
          dataInsight: {
            kpis: respData.kpis,
          },
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setSuggestedFollowUps(respData.suggestedFollowUps || []);
      } catch (err: any) {
        console.error("Erro ao consultar Assistente Comercial:", err);
        setError(err.message || "Erro de conexão com o Assistente Comercial.");
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. Cabeçalho Executivo & Governança */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">Assistente Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Assistente Comercial — IA Executiva
              </h1>
              <p className="text-xs text-muted-foreground">
                Consultas Executivas em Linguagem Natural Consumindo Fontes Oficiais Homologadas
              </p>
            </div>
          </div>
        </div>

        {/* Badge de Governança Financeira */}
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span className="font-mono text-[11px] font-bold text-foreground">
            ASSISTANT_ENGINE = ISOLATED
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtros */}
      <AssistantFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {/* Mensagem de Erro se houver */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 3. Sugestões de Perguntas */}
      <AssistantSuggestedQueries
        onSelectQuery={handleSendMessage}
        loading={loading}
      />

      {/* 4. Chat com IA Executiva */}
      <AssistantChat
        messages={messages}
        onSendMessage={handleSendMessage}
        onFollowUp={handleSendMessage}
        suggestedFollowUps={suggestedFollowUps}
        loading={loading}
      />

      {/* 5. Drawer Lateral Read-Only */}
      <AssistantDrawer
        message={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
