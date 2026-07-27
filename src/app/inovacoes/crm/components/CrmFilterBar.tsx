"use client";

import React, { useEffect, useState } from "react";
import { Filter, RotateCcw, Calendar, User, MapPin, Tag, Building2 } from "lucide-react";

export interface CrmFiltersState {
  startMonth: string;
  endMonth: string;
  manager: string;
  uf: string;
  channel: string;
  matriz: string;
}

interface CrmFilterBarProps {
  filters: CrmFiltersState;
  onFilterChange: (newFilters: CrmFiltersState) => void;
  onReset: () => void;
  loading?: boolean;
}

export const CrmFilterBar: React.FC<CrmFilterBarProps> = ({
  filters,
  onFilterChange,
  onReset,
  loading = false,
}) => {
  const [filterOptions, setFilterOptions] = useState<{
    managers: string[];
    ufs: string[];
    channels: string[];
    matrizes: string[];
  }>({
    managers: [],
    ufs: [],
    channels: [],
    matrizes: [],
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await fetch("/api/dashboard/filters");
        if (res.ok) {
          const json = await res.json();
          if (json.filters) {
            setFilterOptions({
              managers: json.filters.managers || [],
              ufs: json.filters.ufs || [],
              channels: json.filters.channels || [],
              matrizes: json.filters.matrizes || [],
            });
          }
        }
      } catch (err) {
        console.error("Erro ao carregar opções de filtro CRM:", err);
      }
    }
    loadOptions();
  }, []);

  const handleChange = (key: keyof CrmFiltersState, value: string) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Filtros da Inteligência CRM</h3>
            <p className="text-[11px] text-muted-foreground">Filtre as recomendações prescritivas por período, gerente, UF, canal ou rede</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpar Filtros
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Mês Inicial */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gold" />
            Mês Inicial
          </label>
          <input
            type="month"
            value={filters.startMonth}
            onChange={(e) => handleChange("startMonth", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Mês Final */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gold" />
            Mês Final
          </label>
          <input
            type="month"
            value={filters.endMonth}
            onChange={(e) => handleChange("endMonth", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Gerente */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3 text-gold" />
            Gerente
          </label>
          <select
            value={filters.manager}
            onChange={(e) => handleChange("manager", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          >
            <option value="all">Todos os Gerentes</option>
            {filterOptions.managers.map((m, idx) => (
              <option key={`${m}-${idx}`} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* UF */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gold" />
            UF (Estado)
          </label>
          <select
            value={filters.uf}
            onChange={(e) => handleChange("uf", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          >
            <option value="all">Todas as UFs</option>
            {filterOptions.ufs.map((u, idx) => (
              <option key={`${u}-${idx}`} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {/* Canal */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3 text-gold" />
            Canal
          </label>
          <select
            value={filters.channel}
            onChange={(e) => handleChange("channel", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          >
            <option value="all">Todos os Canais</option>
            {filterOptions.channels.map((c, idx) => (
              <option key={`${c}-${idx}`} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Rede / Matriz */}
        <div className="space-y-1">
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3 text-gold" />
            Rede / Matriz
          </label>
          <select
            value={filters.matriz}
            onChange={(e) => handleChange("matriz", e.target.value)}
            disabled={loading}
            className="w-full h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none disabled:opacity-50"
          >
            <option value="all">Todas as Redes</option>
            {filterOptions.matrizes.map((r, idx) => (
              <option key={`${r}-${idx}`} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
