"use client";

import { useGovernanceInconsistencies } from "../hooks";
import { Search, AlertTriangle, AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import React, { useState } from "react";
import { INCONSISTENCIA_CODES, TipoInconsistencia } from "@/lib/governance/constants";

export function QualityAlertsTable() {
  const {
    loading,
    error,
    data: inconsistencies,
    pagination,
    page,
    search,
    tipo,
    sortBy,
    sortDesc,
    setPage,
    setSearch,
    setTipo,
    setSorting,
  } = useGovernanceInconsistencies();

  const [inputSearch, setInputSearch] = useState(search);

  // Debounced search trigger
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(inputSearch);
    setPage(1);
  };

  const getInconsistenciaLabel = (code: TipoInconsistencia) => {
    const labels: Record<TipoInconsistencia, string> = {
      [INCONSISTENCIA_CODES.SEM_UF]: "Sem UF cadastrado",
      [INCONSISTENCIA_CODES.MATRIZ_INEXISTENTE]: "Código de Matriz Inexistente",
      [INCONSISTENCIA_CODES.GERENTE_SEM_MATRIZ]: "Gerente s/ Matriz Associada",
      [INCONSISTENCIA_CODES.DIVERGENCIA_OWNERSHIP]: "Divergência de Gerente (SSOT)",
    };
    return labels[code] || code;
  };

  const getBadgeStyle = (code: TipoInconsistencia) => {
    const styles: Record<TipoInconsistencia, string> = {
      [INCONSISTENCIA_CODES.SEM_UF]: "bg-red-500/10 text-red-600 border-red-500/20",
      [INCONSISTENCIA_CODES.MATRIZ_INEXISTENTE]: "bg-red-500/10 text-red-600 border-red-500/20",
      [INCONSISTENCIA_CODES.GERENTE_SEM_MATRIZ]: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      [INCONSISTENCIA_CODES.DIVERGENCIA_OWNERSHIP]: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    };
    return styles[code] || "bg-slate-100 text-slate-600";
  };

  const SortHeader = ({ field, label }: { field: string; label: string }) => {
    const active = sortBy === field;
    return (
      <button
        onClick={() => setSorting(field)}
        className="flex items-center gap-1 hover:text-foreground text-xs uppercase font-medium tracking-wider"
      >
        {label}
        <ArrowUpDown className={`w-3.5 h-3.5 ${active ? "text-amber-500" : "text-muted-foreground/40"}`} />
      </button>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Alertas de Inconsistências Ativas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastros comerciais que divergem das regras de governança e da SSOT.
          </p>
        </div>

        {/* Filter and Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por parceiro..."
              value={inputSearch}
              onChange={(e) => setInputSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </form>

          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-56 px-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">Todas Inconsistências</option>
            {Object.values(INCONSISTENCIA_CODES).map((code) => (
              <option key={code} value={code}>
                {getInconsistenciaLabel(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-xl w-full"></div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl text-center text-sm flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : !inconsistencies || inconsistencies.length === 0 ? (
        <div className="text-center py-12 bg-background/50 border border-border rounded-xl flex flex-col items-center justify-center">
          <Check className="w-12 h-12 text-emerald-500 mb-3 bg-emerald-500/10 p-2 rounded-full border border-emerald-500/20" />
          <h4 className="font-semibold text-foreground">Base Cadastral 100% Saudável</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Nenhuma inconsistência ativa foi detectada pelo motor de auditoria contínua!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-xs text-muted-foreground/80 tracking-wider">
                  <th className="pb-3 px-4"><SortHeader field="cliente_codigo" label="Cód. Cliente" /></th>
                  <th className="pb-3 px-4"><SortHeader field="nome_parceiro" label="Parceiro" /></th>
                  <th className="pb-3 px-4"><SortHeader field="uf" label="UF" /></th>
                  <th className="pb-3 px-4"><SortHeader field="responsavel" label="Gerente Atual" /></th>
                  <th className="pb-3 px-4"><SortHeader field="tipo_inconsistencia" label="Tipo" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-xs">
                {inconsistencies.map((log, i) => (
                  <tr key={i} className="hover:bg-muted/10 transition-colors group">
                    <td className="py-3 px-4 font-mono font-semibold text-foreground/75">
                      {log.cliente_codigo}
                    </td>
                    <td className="py-3 px-4 font-medium text-foreground">
                      {log.nome_parceiro}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-foreground/80">
                      {log.uf || "-"}
                    </td>
                    <td className="py-3 px-4 font-medium text-muted-foreground">
                      {log.responsavel || <span className="italic text-muted-foreground/50">sem gerente</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getBadgeStyle(log.tipo_inconsistencia)}`}>
                        {getInconsistenciaLabel(log.tipo_inconsistencia)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/50 pt-4 text-xs">
              <span className="text-muted-foreground">
                Exibindo {inconsistencies.length} de {pagination.total_records} alertas
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-1.5 bg-card border border-border rounded-lg hover:bg-muted/10 transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold">
                  Página {page} de {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(Math.min(pagination.total_pages, page + 1))}
                  disabled={page === pagination.total_pages}
                  className="p-1.5 bg-card border border-border rounded-lg hover:bg-muted/10 transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
