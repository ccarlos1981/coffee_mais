"use client";

import React, { useState } from "react";
import { Radar, Search, ArrowUpRight } from "lucide-react";
import { IntelligenceOpportunityRadar } from "@/lib/governance/analytics/intelligence";

interface InteligenciaRadarGridProps {
  radarOportunidades: IntelligenceOpportunityRadar[];
  onSelectRadar: (item: IntelligenceOpportunityRadar) => void;
  loading?: boolean;
}

export const InteligenciaRadarGrid: React.FC<InteligenciaRadarGridProps> = ({
  radarOportunidades,
  onSelectRadar,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("ALL");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const filteredData = radarOportunidades.filter((item) => {
    const matchText =
      !searchTerm ||
      item.entidadeNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.gerenteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoriaFilter === "ALL" || item.categoria === categoriaFilter;
    return matchText && matchCat;
  });

  const getCategoriaLabel = (cat: IntelligenceOpportunityRadar["categoria"]) => {
    switch (cat) {
      case "EXPANSAO_ESTRATECICA":
        return "🚀 Expansão Estratégica";
      case "RISCO_OPERACOES":
        return "🚨 Risco Operacional";
      case "EFICIENCIA_MARGEM":
        return "💰 Eficiência de Margem";
      case "POSITIVACAO_CRITICA":
        return "📦 Positivação Crítica";
      default:
        return cat;
    }
  };

  const getRiscoBadge = (risco: IntelligenceOpportunityRadar["nivelRisco"]) => {
    switch (risco) {
      case "ALTO":
        return "bg-rose-500/10 text-rose-500 border-rose-500/30";
      case "MEDIO":
        return "bg-amber-500/10 text-amber-500 border-amber-500/30";
      case "BAIXO":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/30";
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Radar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Radar Estratégico de Inteligência Comercial</h3>
            <p className="text-[11px] text-muted-foreground">
              Alertas consolidados de alto impacto priorizados por inteligência cruzada
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="ALL">Todas as Categorias</option>
            <option value="EXPANSAO_ESTRATECICA">🚀 Expansão Estratégica</option>
            <option value="RISCO_OPERACOES">🚨 Risco Operacional</option>
            <option value="EFICIENCIA_MARGEM">💰 Eficiência de Margem</option>
            <option value="POSITIVACAO_CRITICA">📦 Positivação Crítica</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar no Radar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Carregando oportunidades do Radar Estratégico...
        </div>
      ) : filteredData.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          Nenhuma oportunidade encontrada no Radar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredData.slice(0, 9).map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectRadar(item)}
              className="bg-background border border-border rounded-2xl p-4 hover:border-gold/60 transition-all cursor-pointer space-y-3 flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-gold uppercase tracking-wider">
                    {getCategoriaLabel(item.categoria)}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRiscoBadge(
                      item.nivelRisco
                    )}`}
                  >
                    Score {item.scorePrioridade}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-gold transition-colors">
                  {item.titulo}
                </h4>

                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {item.descricao}
                </p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground text-[10px] truncate max-w-[140px]" title={item.entidadeNome}>
                  {item.entidadeNome}
                </span>
                <span className="font-bold text-emerald-500">
                  {formatCur(item.impactoEstimado)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
