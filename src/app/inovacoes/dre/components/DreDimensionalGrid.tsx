"use client";

import React, { useState } from "react";
import { Search, ArrowUpDown, Layers } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";

interface DreDimensionalGridProps {
  dimensionais: DreComercialData["dimensionais"];
  loading?: boolean;
}

export const DreDimensionalGrid: React.FC<DreDimensionalGridProps> = ({
  dimensionais,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<"faturamentoLiquido" | "maco" | "margemMacoPercentual">("faturamentoLiquido");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleSort = (field: "faturamentoLiquido" | "maco" | "margemMacoPercentual") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredData = dimensionais
    .filter((d) => !searchTerm || d.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Detalhamento por Dimensão Comercial</h3>
            <p className="text-[11px] text-muted-foreground">
              Análise de rentabilidade e Margem de Contribuição (MACO) por agrupamento
            </p>
          </div>
        </div>

        {/* Campo de busca */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Tabela Dimensional */}
      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Carregando detalhamento dimensional da DRE...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Nome / Dimensão</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("faturamentoLiquido")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Receita Líquida</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">Impostos</th>
                <th className="py-2.5 px-3 text-right">CPV</th>
                <th className="py-2.5 px-3 text-right">Margem Bruta</th>
                <th className="py-2.5 px-3 text-right">Frete (3%)</th>
                <th className="py-2.5 px-3 text-right">Invest. Trade</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("maco")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>MACO (R$)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("margemMacoPercentual")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>MACO (%)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((item) => {
                const isPositiveMaco = item.maco >= 0;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground max-w-[220px] truncate" title={item.nome}>
                      {item.nome}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                      {formatCur(item.faturamentoLiquido)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {formatCur(item.impostos)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {formatCur(item.cpv)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                      {formatCur(item.margemBruta)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {formatCur(item.frete)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {formatCur(item.investimentoComercial)}
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        isPositiveMaco ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {formatCur(item.maco)}
                    </td>

                    <td className="py-2.5 px-3 text-center font-mono">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPositiveMaco
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {item.margemMacoPercentual.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
