"use client";

import React, { useState } from "react";
import { Search, ArrowUpDown, Shield, ChevronRight } from "lucide-react";
import { CrmOportunidade } from "@/lib/governance/analytics/engine";

interface CrmOportunidadesGridProps {
  oportunidades: CrmOportunidade[];
  onSelectOportunidade: (op: CrmOportunidade) => void;
  loading?: boolean;
}

export const CrmOportunidadesGrid: React.FC<CrmOportunidadesGridProps> = ({
  oportunidades,
  onSelectOportunidade,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"scoreImpacto" | "valorImpactoPotencial" | "diasSemComprar">("scoreImpacto");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleSort = (field: "scoreImpacto" | "valorImpactoPotencial" | "diasSemComprar") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredData = oportunidades
    .filter((op) => {
      const matchText =
        !searchTerm ||
        op.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.matrizNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.gerenteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.titulo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPriority = priorityFilter === "ALL" || op.prioridade === priorityFilter;
      return matchText && matchPriority;
    })
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });

  const getPriorityBadge = (p: string) => {
    switch (p) {
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Central de Oportunidades & Ações Prescritivas</h3>
            <p className="text-[11px] text-muted-foreground">
              Selecione qualquer oportunidade para visualizar a ficha prescritiva detalhada do cliente
            </p>
          </div>
        </div>

        {/* Filtros da Tabela */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="ALL">Todas as Prioridades</option>
            <option value="ALTA">🔴 Alta Criticidade</option>
            <option value="MEDIA">🟠 Média Criticidade</option>
            <option value="BAIXA">🟡 Baixa Criticidade</option>
            <option value="OPORTUNIDADE">🟢 Oportunidade</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por cliente, rede..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Oportunidades */}
      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Processando inteligência prescritiva das oportunidades...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhuma oportunidade comercial encontrada.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th
                  className="py-2.5 px-3 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("scoreImpacto")}
                >
                  <div className="flex items-center gap-1">
                    <span>Score (0-100)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Cliente / Rede</th>
                <th className="py-2.5 px-3">Gerente</th>
                <th className="py-2.5 px-3">Recomendação Prescritiva</th>
                <th className="py-2.5 px-3 text-center">Criticidade</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("valorImpactoPotencial")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Impacto Potencial</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("diasSemComprar")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Dias sem Compra</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((op) => (
                <tr
                  key={op.id}
                  onClick={() => onSelectOportunidade(op)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-3 font-mono font-black text-gold text-center w-20">
                    <span className="inline-block bg-gold/10 text-gold px-2 py-0.5 rounded-lg border border-gold/20">
                      {op.scoreImpacto}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 max-w-[200px]">
                    <div className="font-bold text-foreground truncate" title={op.clienteNome}>
                      {op.clienteNome}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{op.matrizNome}</div>
                  </td>

                  <td className="py-2.5 px-3 text-muted-foreground text-[11px] truncate max-w-[120px]">
                    {op.gerenteNome}
                  </td>

                  <td className="py-2.5 px-3 text-foreground font-medium max-w-[240px] truncate" title={op.titulo}>
                    {op.titulo}
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getPriorityBadge(
                        op.prioridade
                      )}`}
                    >
                      {op.prioridade}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-500">
                    {formatCur(op.valorImpactoPotencial)}
                  </td>

                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                    {op.diasSemComprar}d
                  </td>

                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      className="p-1 rounded-lg hover:bg-gold/20 text-gold transition-colors inline-flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
