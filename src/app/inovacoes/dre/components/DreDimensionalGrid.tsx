"use client";

import React, { useState } from "react";
import { Search, ArrowUpDown, Layers, LayoutGrid, FileText } from "lucide-react";
import { DreComercialData } from "@/lib/governance/analytics/engine";
import { TableSkeletonRows } from "@/components/Skeleton";

interface DreDimensionalGridProps {
  dimensionais: DreComercialData["dimensionais"];
  loading?: boolean;
}

export type ViewMode = "gerencial" | "oficial";

export const DreDimensionalGrid: React.FC<DreDimensionalGridProps> = ({
  dimensionais,
  loading = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("gerencial");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortField, setSortField] = useState<
    "faturamentoBruto" | "faturamentoLiquido" | "maco" | "margemMacoPercentual" | "volume" | "precoMedio"
  >("faturamentoLiquido");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatNum = (val: number) =>
    new Intl.NumberFormat("pt-BR").format(val);

  const handleSort = (
    field: "faturamentoBruto" | "faturamentoLiquido" | "maco" | "margemMacoPercentual" | "volume" | "precoMedio"
  ) => {
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
      const valA = a[sortField] || 0;
      const valB = b[sortField] || 0;
      return sortDirection === "desc" ? valB - valA : valA - valB;
    });

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

        {/* Alternador de Visão + Campo de busca */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Seletor de Visão (Gerencial vs Oficial Core) */}
          <div className="bg-muted/60 p-1 rounded-xl flex items-center gap-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode("gerencial")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "gerencial"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-gold" />
              Visão Gerencial (Executiva)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("oficial")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === "oficial"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              Visão Oficial (DRE Core)
            </button>
          </div>

          {/* Campo de busca */}
          <div className="relative w-full sm:w-56">
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
      </div>

      {/* Tabela Dimensional */}
      <div className="overflow-x-auto rounded-xl border border-border" aria-busy={loading}>
        {loading ? (
          <table className="w-full text-left text-xs whitespace-nowrap" aria-label="Carregando detalhamento dimensional da DRE">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Dimensão</th>
                <th className="py-2.5 px-3 text-right">Volume (un)</th>
                <th className="py-2.5 px-3 text-right">Preço Médio</th>
                <th className="py-2.5 px-3 text-right">Receita Bruta</th>
                <th className="py-2.5 px-3 text-right">(-) Descontos</th>
                <th className="py-2.5 px-3 text-right">Receita Líquida</th>
                <th className="py-2.5 px-3 text-right">(-) Impostos</th>
                <th className="py-2.5 px-3 text-right">Rec. Pós-Impostos</th>
                <th className="py-2.5 px-3 text-right">(-) CPV</th>
                <th className="py-2.5 px-3 text-right">Margem Bruta</th>
                <th className="py-2.5 px-3 text-right">(-) Investimento</th>
                <th className="py-2.5 px-3 text-right font-bold text-gold">MACO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <TableSkeletonRows rows={10} columns={12} />
            </tbody>
          </table>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : viewMode === "gerencial" ? (
          /* ========================================================================= */
          /* 1. CASCATA GERENCIAL EXECUTIVA (12 COLUNAS)                               */
          /* ========================================================================= */
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3 sticky left-0 bg-card z-10">Dimensão</th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("volume")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Volume (un)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("precoMedio")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Preço Médio</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("faturamentoBruto")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Receita Bruta</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right text-amber-500 font-bold">(-) Descontos</th>
                <th
                  className="py-2.5 px-3 text-right font-bold text-foreground cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("faturamentoLiquido")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>(=) Receita Líquida</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">(-) Impostos</th>
                <th className="py-2.5 px-3 text-right">(-) Investimento</th>
                <th className="py-2.5 px-3 text-right">(-) CPV</th>
                <th className="py-2.5 px-3 text-right">(-) Frete (3%)</th>
                <th
                  className="py-2.5 px-3 text-right font-bold cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("maco")}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>(=) MACO (R$)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 text-center cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSort("margemMacoPercentual")}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>% MACO (Gerencial)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredData.map((item) => {
                const isPositiveMaco = item.maco >= 0;
                const vol = item.volume || 0;
                const pm = item.precoMedio || (vol > 0 ? item.faturamentoBruto / vol : 0);
                const desc = item.descontos || 0;
                const pctGerencial = item.margemMacoGerencialPercentual ?? (item.faturamentoBruto > 0 ? (item.maco / item.faturamentoBruto) * 100 : 0);

                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-semibold text-foreground max-w-[200px] truncate sticky left-0 bg-card z-10 border-r border-border" title={item.nome}>
                      {item.nome}
                    </td>

                    <td className="py-2.5 px-3 text-right text-foreground">
                      {vol > 0 ? `${formatNum(vol)} un` : "—"}
                    </td>

                    <td className="py-2.5 px-3 text-right text-foreground">
                      {pm > 0 ? formatCur(pm) : "—"}
                    </td>

                    <td className="py-2.5 px-3 text-right font-medium text-foreground">
                      {formatCur(item.faturamentoBruto)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-amber-500 font-medium">
                      {formatCur(desc)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-bold text-foreground bg-muted/20">
                      {formatCur(item.faturamentoLiquido)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.impostos)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.investimentoComercial)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.cpv)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.frete)}
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        isPositiveMaco ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {formatCur(item.maco)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isPositiveMaco
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                        }`}
                      >
                        {pctGerencial.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* ========================================================================= */
          /* 2. VISÃO OFICIAL DRE CORE (9 COLUNAS BASELINE)                            */
          /* ========================================================================= */
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3 sticky left-0 bg-card z-10">Nome / Dimensão</th>
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
                    <span>MACO Oficial (%)</span>
                    <ArrowUpDown className="w-3 h-3 text-gold" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredData.map((item) => {
                const isPositiveMaco = item.maco >= 0;
                return (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2.5 px-3 font-sans font-semibold text-foreground max-w-[220px] truncate sticky left-0 bg-card z-10 border-r border-border" title={item.nome}>
                      {item.nome}
                    </td>

                    <td className="py-2.5 px-3 text-right font-medium text-foreground">
                      {formatCur(item.faturamentoLiquido)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.impostos)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.cpv)}
                    </td>

                    <td className="py-2.5 px-3 text-right font-medium text-foreground">
                      {formatCur(item.margemBruta)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.frete)}
                    </td>

                    <td className="py-2.5 px-3 text-right text-muted-foreground">
                      {formatCur(item.investimentoComercial)}
                    </td>

                    <td
                      className={`py-2.5 px-3 text-right font-bold ${
                        isPositiveMaco ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {formatCur(item.maco)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
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
