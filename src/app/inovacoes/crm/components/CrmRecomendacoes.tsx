"use client";

import React from "react";
import { Zap, AlertCircle, ArrowUpRight, ShieldAlert, Sparkles } from "lucide-react";
import { CrmOportunidade } from "@/lib/governance/analytics/engine";

interface CrmRecomendacoesProps {
  oportunidades: CrmOportunidade[];
  onSelectOportunidade: (op: CrmOportunidade) => void;
  loading?: boolean;
}

export const CrmRecomendacoes: React.FC<CrmRecomendacoesProps> = ({
  oportunidades,
  onSelectOportunidade,
  loading = false,
}) => {
  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const topRecomendacoes = oportunidades.slice(0, 6);

  const getBadgeStyle = (prioridade: string) => {
    switch (prioridade) {
      case "ALTA":
        return "bg-rose-500/10 text-rose-500 border-rose-500/30";
      case "MEDIA":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "BAIXA":
        return "bg-blue-500/10 text-blue-500 border-blue-500/30";
      case "OPORTUNIDADE":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Top Recomendações Prescritivas (Maior Score)</h3>
            <p className="text-[11px] text-muted-foreground">
              Ações comerciais com maior retorno financeiro estimado ordenadas por Inteligência Prescritiva
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Cards Prescritivos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : topRecomendacoes.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma recomendação prioritária identificada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topRecomendacoes.map((op) => (
            <div
              key={op.id}
              onClick={() => onSelectOportunidade(op)}
              className="bg-background border border-border rounded-2xl p-4 hover:border-gold/60 transition-all cursor-pointer space-y-3 flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(
                      op.prioridade
                    )}`}
                  >
                    Score: {op.scoreImpacto} | {op.prioridade}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors" />
                </div>

                <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-gold transition-colors">
                  {op.titulo}
                </h4>

                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {op.descricao}
                </p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground text-[10px]">Impacto Est.:</span>
                <span className="font-bold text-emerald-500">
                  {formatCur(op.valorImpactoPotencial)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
