"use client";

import React from "react";
import { Filter, RefreshCw, User, MapPin, Layers } from "lucide-react";
import { CrmFilterOptions } from "@/lib/crm-enterprise";

interface CrmFilterBarProps {
  filters: CrmFilterOptions;
  onFilterChange: (newFilters: CrmFilterOptions) => void;
  loading: boolean;
  onRefresh: () => void;
}

export const CrmFilterBar: React.FC<CrmFilterBarProps> = ({
  filters,
  onFilterChange,
  loading,
  onRefresh,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
          <Filter className="w-4 h-4 text-gold" />
          <span>Filtros Executivos:</span>
        </div>

        {/* Seletor de Gerente */}
        <select
          value={filters.gerente || "TODOS"}
          onChange={(e) => onFilterChange({ ...filters, gerente: e.target.value })}
          className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:ring-1 focus:ring-gold outline-none"
        >
          <option value="TODOS">Todos os Gerentes</option>
          <option value="Leandro Silva">Leandro Silva</option>
          <option value="Fernanda Costa">Fernanda Costa</option>
          <option value="Carlos Oliveira">Carlos Oliveira</option>
        </select>

        {/* Seletor de Regional */}
        <select
          value={filters.regional || "TODAS"}
          onChange={(e) => onFilterChange({ ...filters, regional: e.target.value })}
          className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:ring-1 focus:ring-gold outline-none"
        >
          <option value="TODAS">Todas as Regionais</option>
          <option value="Sudeste">Sudeste</option>
          <option value="Sul">Sul</option>
          <option value="Nordeste">Nordeste</option>
        </select>

        {/* Seletor de Período */}
        <select
          value={filters.periodo || "MÊS ATUAL"}
          onChange={(e) => onFilterChange({ ...filters, periodo: e.target.value })}
          className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:ring-1 focus:ring-gold outline-none"
        >
          <option value="MÊS ATUAL">Mês Atual (Julho/2026)</option>
          <option value="TRIMESTRE">Trimestre Atual (Q3)</option>
          <option value="ANO">Ano Atual (2026)</option>
        </select>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 self-end md:self-auto"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        Atualizar CRM
      </button>
    </div>
  );
};
