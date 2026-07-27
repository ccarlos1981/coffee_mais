"use client";

import React from "react";
import { MessageSquareCode } from "lucide-react";

interface AssistantSuggestedQueriesProps {
  onSelectQuery: (query: string) => void;
  loading?: boolean;
}

export const AssistantSuggestedQueries: React.FC<AssistantSuggestedQueriesProps> = ({
  onSelectQuery,
  loading = false,
}) => {
  const suggestions = [
    "Qual é a projeção oficial de fechamento do mês?",
    "Qual é o MACO acumulado e a margem percentual?",
    "Quais são os clientes em risco no CRM Comercial?",
    "Qual é o resultado da simulação de expansão comercial?",
    "Qual é o Score de Saúde do Centro de Inteligência Comercial?",
    "Como está o desempenho do canal Varejo em São Paulo?",
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-xl bg-gold/10 text-gold">
          <MessageSquareCode className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-bold text-foreground">Perguntas Executivas Sugeridas</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((sug, idx) => (
          <button
            key={idx}
            type="button"
            disabled={loading}
            onClick={() => onSelectQuery(sug)}
            className="px-3 py-1.5 bg-background hover:bg-muted border border-border rounded-xl text-xs text-muted-foreground hover:text-foreground transition-all disabled:opacity-50 text-left"
          >
            💬 {sug}
          </button>
        ))}
      </div>
    </div>
  );
};
