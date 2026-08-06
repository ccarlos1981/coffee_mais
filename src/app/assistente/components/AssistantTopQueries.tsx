"use client";

import React from "react";
import { Sparkles, HelpCircle } from "lucide-react";

interface AssistantTopQueriesProps {
  onSelectQuery: (query: string) => void;
  loading?: boolean;
}

export const TOP_DIRECTOR_QUERIES = [
  "Quanto vamos fechar este mês?",
  "Quanto falta para a meta?",
  "Quem está pior no ranking de gerentes?",
  "Quem precisa de ajuda imediata na carteira?",
  "Onde estamos perdendo margem MACO?",
  "Qual gerente exige atenção hoje?",
  "Qual distribuidor está em risco de queda?",
  "Vale mais investir em Trade ou conceder desconto?",
  "Quanto preciso vender por dia até o final do mês?",
  "Qual regional apresenta a melhor rentabilidade?",
  "Quais redes Top 10 não compraram este mês?",
  "Qual o ROI simulado para um aporte de R$ 50k em Trade?"
];

export const AssistantTopQueries: React.FC<AssistantTopQueriesProps> = ({
  onSelectQuery,
  loading = false
}) => {
  return (
    <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
            Perguntas da Diretoria (Atalhos C-Level)
          </h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">12 Perguntas Estratégicas</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {TOP_DIRECTOR_QUERIES.map((query, idx) => (
          <button
            key={idx}
            onClick={() => onSelectQuery(query)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-secondary/30 border border-border hover:border-gold hover:bg-secondary/60 text-left transition-all disabled:opacity-50 text-xs font-semibold text-foreground flex items-start gap-2 group"
          >
            <HelpCircle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
            <span className="leading-snug text-[11px]">{query}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
