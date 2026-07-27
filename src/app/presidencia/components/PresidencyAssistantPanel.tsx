"use client";

import React from "react";
import { Bot, MessageSquare } from "lucide-react";
import { PresidencyDashboardData } from "@/lib/governance/analytics/presidency";

interface PresidencyAssistantPanelProps {
  insights: PresidencyDashboardData["insightsIA"];
  loading?: boolean;
}

export const PresidencyAssistantPanel: React.FC<PresidencyAssistantPanelProps> = ({
  insights,
  loading = false,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gold/10 text-gold">
          <Bot className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Inteligência & Insights Executivos IA</h3>
          <p className="text-[11px] text-muted-foreground">Origem: Assistente Comercial IA (Linguagem Natural)</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((item, idx) => (
          <div key={idx} className="p-4 bg-background border border-border rounded-xl space-y-2 text-xs">
            <div className="flex items-center gap-2 text-gold font-bold text-[11px]">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{item.pergunta}</span>
            </div>
            <p className="text-muted-foreground leading-relaxed font-sans">{item.resposta}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
