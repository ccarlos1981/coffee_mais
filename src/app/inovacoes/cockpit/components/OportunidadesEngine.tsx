"use client";

import React, { useState } from "react";
import { Sparkles, AlertTriangle, TrendingDown, Rocket, CheckCircle2, ArrowUpRight } from "lucide-react";
import { CockpitComercialData } from "@/lib/governance/analytics/engine";

interface OportunidadesEngineProps {
  oportunidades: CockpitComercialData["oportunidades"];
  loading?: boolean;
}

export const OportunidadesEngine: React.FC<OportunidadesEngineProps> = ({
  oportunidades,
  loading = false,
}) => {
  const [filterType, setFilterType] = useState<string>("TODOS");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const filteredOportunidades = oportunidades.filter((op) => {
    if (filterType === "TODOS") return true;
    return op.tipo === filterType;
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "REATIVACAO":
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "QUEDA_CRITICA":
        return <TrendingDown className="w-4 h-4 text-rose-500" />;
      case "EXPANSAO":
        return <Rocket className="w-4 h-4 text-emerald-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-gold" />;
    }
  };

  const getPriorityStyle = (prio: string) => {
    switch (prio) {
      case "ALTA":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "MEDIA":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Motor de Oportunidades Comerciais</h3>
            <p className="text-[11px] text-muted-foreground">
              Alertas automáticos orientados à ação para reativação, mitigação de risco e expansão
            </p>
          </div>
        </div>

        {/* Filtros por tipo */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
          {[
            { id: "TODOS", label: "Todas" },
            { id: "REATIVACAO", label: "Reativação" },
            { id: "QUEDA_CRITICA", label: "Risco de Queda" },
            { id: "EXPANSAO", label: "Expansão" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === tab.id
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Cards de Oportunidades */}
      {loading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Calculando oportunidades analíticas...
        </div>
      ) : filteredOportunidades.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma oportunidade mapeada para este filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOportunidades.map((op, idx) => (
            <div
              key={`${op.tipo}-${op.clienteOuRede}-${idx}`}
              className="bg-background/50 border border-border/80 p-4 rounded-xl space-y-2 relative group hover:border-gold/50 transition-all shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-card border border-border">
                    {getTipoIcon(op.tipo)}
                  </div>
                  <h4 className="text-xs font-bold text-foreground line-clamp-1" title={op.titulo}>
                    {op.titulo}
                  </h4>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${getPriorityStyle(
                    op.nivelPrioridade
                  )}`}
                >
                  Prioridade {op.nivelPrioridade}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {op.descricao}
              </p>

              <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Impacto Potencial
                </span>
                <span className="font-mono font-bold text-gold flex items-center gap-1">
                  {formatCur(op.valorImpactoPotencial)}
                  <ArrowUpRight className="w-3 h-3 text-gold/80" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
