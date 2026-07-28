"use client";

import React from "react";
import { Filter, RefreshCw, Sparkles, User, MapPin } from "lucide-react";
import { DecisionFilterOptions } from "@/lib/commercial-decision";

interface DecisionFilterBarProps {
  filters: DecisionFilterOptions;
  onFilterChange: (newFilters: DecisionFilterOptions) => void;
  loading: boolean;
  onRefresh: () => void;
}

export const DecisionFilterBar: React.FC<DecisionFilterBarProps> = ({
  filters,
  onFilterChange,
  loading,
  onRefresh,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>Filtros do Assistente:</span>
        </div>

        {/* Seletor de Gerente */}
        <select
          value={filters.gerente || "TODOS"}
          onChange={(e) => onFilterChange({ ...filters, gerente: e.target.value })}
          className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:ring-1 focus:ring-purple-500 outline-none"
        >
          <option value="TODOS">Todos os Gerentes</option>
          <option value="Leandro Silva">Leandro Silva</option>
          <option value="Fernanda Costa">Fernanda Costa</option>
          <option value="Carlos Oliveira">Carlos Oliveira</option>
        </select>

        {/* Seletor de Nível de Risco */}
        <select
          value={filters.nivelRisco || "TODOS"}
          onChange={(e) => onFilterChange({ ...filters, nivelRisco: e.target.value })}
          className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:ring-1 focus:ring-purple-500 outline-none"
        >
          <option value="TODOS">Todos os Níveis de Risco</option>
          <option value="CRITICAL">Crítico (Score &gt; 80)</option>
          <option value="HIGH">Alto (Score 70-80)</option>
          <option value="MEDIUM">Médio (Score &lt; 70)</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 self-end md:self-auto"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        Recalcular Recomendações
      </button>
    </div>
  );
};
