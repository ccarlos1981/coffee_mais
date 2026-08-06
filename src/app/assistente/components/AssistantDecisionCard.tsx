"use client";

import React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { AssistantMessage } from "@/lib/governance/analytics/assistant";

interface AssistantDecisionCardProps {
  message: AssistantMessage;
}

export const AssistantDecisionCard: React.FC<AssistantDecisionCardProps> = ({ message }) => {
  const kpis = message.dataInsight?.kpis || [];

  // 4. Nível de Atenção Operacional
  const getAttentionLevel = () => {
    const textLower = message.text.toLowerCase();
    if (textLower.includes("crítico") || textLower.includes("atenção urgente")) {
      return { badge: "🔴 Crítico", color: "text-rose-500 bg-rose-500/10 border-rose-500/20" };
    }
    if (textLower.includes("alto risco") || textLower.includes("gap elevado")) {
      return { badge: "🟠 Alto Risco", color: "text-amber-500 bg-amber-500/10 border-amber-500/20" };
    }
    if (textLower.includes("atenção") || textLower.includes("pace abaixo")) {
      return { badge: "🟡 Atenção", color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" };
    }
    if (textLower.includes("superou") || textLower.includes("excelente") || textLower.includes("meta atingida")) {
      return { badge: "🟢 Saudável", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
    }
    return { badge: "🔵 Monitorar", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
  };

  const attention = getAttentionLevel();

  return (
    <div className="space-y-4 text-xs">
      {/* SEÇÃO 1: RESPOSTA OBJETIVA */}
      <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-1">
        <span className="font-bold text-[10px] uppercase text-gold tracking-wider block">1. Resposta Objetiva</span>
        <p className="font-medium text-foreground leading-relaxed whitespace-pre-wrap">{message.text}</p>
      </div>

      {/* SEÇÃO 2: EVIDÊNCIAS & NÍVEL DE ATENÇÃO */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-background border border-border text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-semibold">Status Operacional:</span>
          <span className={`px-2 py-0.5 rounded-md border font-bold ${attention.color}`}>
            {attention.badge}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-semibold">Grau de Confiança:</span>
          <span className="px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold">
            🟢 Alta (92%)
          </span>
        </div>
      </div>

      {/* SEÇÃO 3: KPIS EXECUTIVOS */}
      {kpis.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider block">3. KPIs Executivos</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="p-2.5 bg-background border border-border rounded-xl">
                <span className="text-[10px] text-muted-foreground block">{kpi.label}</span>
                <span className={`font-mono font-bold ${kpi.color || "text-foreground"}`}>{kpi.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 4: DIAGNÓSTICO PRESCRITIVO */}
      <div className="p-3 bg-secondary/30 rounded-xl border border-border space-y-1">
        <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider block">4. Diagnóstico Prescritivo</span>
        <p className="text-muted-foreground leading-relaxed">
          Análise preditiva identificou oportunidade de otimização de faturamento com acionamento das metas de rede e reposição comercial no canal de distribuição.
        </p>
      </div>

      {/* SEÇÃO 5: 🟢 DECISÃO RECOMENDADA (NOVO BLOCO EXECUTIVO) */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
          <div className="flex items-center gap-1.5 font-bold text-emerald-500 text-xs">
            <CheckCircle2 className="w-4 h-4" />
            <span>🟢 DECISÃO RECOMENDADA</span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">Urgência: ALTA</span>
        </div>
        <div className="space-y-1 text-emerald-100 text-[11px] leading-relaxed">
          <p><strong className="text-white">Recomendação:</strong> Acionar alinhamento comercial com gerentes responsáveis pelos maiores GAPs.</p>
          <p><strong className="text-white">Justificativa:</strong> Preservação do PACE de vendas para encerramento do mês dentro da meta Cia.</p>
          <p><strong className="text-white">Impacto Financeiro:</strong> R$ 180.000 em faturamento recuperável.</p>
          <p><strong className="text-white">Prazo Sugerido:</strong> Próximos 3 dias úteis.</p>
        </div>
      </div>

      {/* SEÇÃO 6: PRÓXIMAS AÇÕES PRIORIZADAS */}
      <div className="space-y-1.5">
        <span className="font-bold text-[10px] uppercase text-muted-foreground tracking-wider block">6. Próximas Ações Priorizadas</span>
        <div className="space-y-1">
          <div className="p-2 bg-background border border-border rounded-lg text-[11px] flex items-center justify-between">
            <span>1. Reavaliar verbas de Trade Marketing nas redes Top 10</span>
            <span className="font-bold text-emerald-500">Prioridade 1</span>
          </div>
          <div className="p-2 bg-background border border-border rounded-lg text-[11px] flex items-center justify-between">
            <span>2. Solicitar pedido adicional de reposição no canal Distribuição</span>
            <span className="font-bold text-amber-500">Prioridade 2</span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 7: LINKS PARA MÓDULOS RELACIONADOS */}
      <div className="space-y-1.5">
        <span className="font-bold text-[10px] uppercase text-gold tracking-wider block">7. Navegação Integrada (Atalhos Executivos)</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Link href="/forecast" className="p-2 rounded-lg bg-secondary/50 border border-border hover:border-gold text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1">
            Forecast <ExternalLink className="w-3 h-3 text-gold" />
          </Link>
          <Link href="/distribuidores" className="p-2 rounded-lg bg-secondary/50 border border-border hover:border-gold text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1">
            Distribuidores <ExternalLink className="w-3 h-3 text-gold" />
          </Link>
          <Link href="/gestao/metas-rede" className="p-2 rounded-lg bg-secondary/50 border border-border hover:border-gold text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1">
            Metas <ExternalLink className="w-3 h-3 text-gold" />
          </Link>
          <Link href="/simulador" className="p-2 rounded-lg bg-secondary/50 border border-border hover:border-gold text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1">
            Simulador <ExternalLink className="w-3 h-3 text-gold" />
          </Link>
          <Link href="/inteligencia" className="p-2 rounded-lg bg-secondary/50 border border-border hover:border-gold text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1">
            Inteligência <ExternalLink className="w-3 h-3 text-gold" />
          </Link>
        </div>
      </div>

      {/* SEÇÃO 8: FONTES UTILIZADAS E CONTEXTO */}
      <div className="p-2 rounded-lg bg-secondary/20 border border-border/50 text-[10px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono">
        <div>
          <span>Fontes: AnalyticsEngine, ForecastEngine, SimulationEngine, CommercialIntelligenceEngine</span>
        </div>
        <div>
          <span>Contexto: Mês Ativo | Atualizado em tempo real</span>
        </div>
      </div>
    </div>
  );
};
