"use client";

import React, { useState } from "react";
import { Search, HeartPulse, ShieldAlert, TrendingDown, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { CockpitComercialData } from "@/lib/governance/analytics/engine";
import { TableSkeletonRows } from "@/components/Skeleton";

interface SaudeCarteiraGridProps {
  data: CockpitComercialData["saudeCarteira"];
  loading?: boolean;
}

export const SaudeCarteiraGrid: React.FC<SaudeCarteiraGridProps> = ({ data, loading = false }) => {
  const [activeTab, setActiveTab] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatFmtDate = (dStr: string | null) => {
    if (!dStr) return "Sem compras";
    const parts = dStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dStr;
  };

  const filteredData = data.filter((c) => {
    const matchesSearch =
      !searchTerm ||
      c.nomeParceiro.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.rede && c.rede.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.manager && c.manager.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "RISCO") return c.classificacaoSaude === "Em Risco";
    if (activeTab === "EXPANSAO") return c.classificacaoSaude === "Em Expansão";
    if (activeTab === "ATENCAO") return c.situacaoComercial === "Atenção";
    if (activeTab === "INATIVO") return c.situacaoComercial === "Inativo" || c.situacaoComercial === "Sem vendas";
    if (activeTab === "ATIVO") return c.situacaoComercial === "Ativo";

    return true;
  });

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case "Em Risco":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "Em Expansão":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "Atenção":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "Inativo":
      case "Sem vendas":
        return "bg-muted/50 text-muted-foreground border-border";
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
            <HeartPulse className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Saúde da Carteira de Clientes</h3>
            <p className="text-[11px] text-muted-foreground">
              Monitoramento de recência, tendência de faturamento e risco de churn
            </p>
          </div>
        </div>

        {/* Campo de busca */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar cliente, rede ou gerente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 bg-background border border-input rounded-xl text-xs text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs de Filtro */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "TODOS", label: "Todos", count: data.length },
          { id: "RISCO", label: "⚠️ Em Risco", count: data.filter((c) => c.classificacaoSaude === "Em Risco").length },
          { id: "EXPANSAO", label: "🚀 Em Expansão", count: data.filter((c) => c.classificacaoSaude === "Em Expansão").length },
          { id: "ATENCAO", label: "🕒 Atenção", count: data.filter((c) => c.situacaoComercial === "Atenção").length },
          { id: "INATIVO", label: "💤 Inativos", count: data.filter((c) => c.situacaoComercial === "Inativo" || c.situacaoComercial === "Sem vendas").length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "bg-gold text-gold-foreground shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/50 font-mono">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela de Clientes */}
      <div className="overflow-x-auto rounded-xl border border-border" aria-busy={loading}>
        {loading ? (
          <table className="w-full text-left text-xs" aria-label="Carregando indicadores de saúde da carteira">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Cliente / Parceiro</th>
                <th className="py-2.5 px-3">Rede / Matriz</th>
                <th className="py-2.5 px-3">Gerente</th>
                <th className="py-2.5 px-3 text-center">Última Compra</th>
                <th className="py-2.5 px-3 text-center">Recência</th>
                <th className="py-2.5 px-3 text-right">Fat. Período</th>
                <th className="py-2.5 px-3 text-right">Fat. 12M</th>
                <th className="py-2.5 px-3 text-center">Saúde / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <TableSkeletonRows rows={8} columns={8} />
            </tbody>
          </table>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Nenhum cliente encontrado para os filtros selecionados.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
              <tr>
                <th className="py-2.5 px-3">Cliente / Parceiro</th>
                <th className="py-2.5 px-3">Rede / Matriz</th>
                <th className="py-2.5 px-3">Gerente</th>
                <th className="py-2.5 px-3 text-center">Última Compra</th>
                <th className="py-2.5 px-3 text-center">Recência</th>
                <th className="py-2.5 px-3 text-right">Fat. Período</th>
                <th className="py-2.5 px-3 text-right">Fat. 12M</th>
                <th className="py-2.5 px-3 text-center">Saúde / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.slice(0, 50).map((item) => (
                <tr key={item.clienteId} className="hover:bg-muted/30 transition-colors">
                  {/* Cliente */}
                  <td className="py-2.5 px-3 font-semibold text-foreground max-w-[220px] truncate" title={item.nomeParceiro}>
                    {item.nomeParceiro}
                  </td>

                  {/* Rede */}
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {item.rede || "—"}
                  </td>

                  {/* Gerente */}
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {item.manager || "Outros"}
                  </td>

                  {/* Última Compra */}
                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">
                    {formatFmtDate(item.ultimaCompra)}
                  </td>

                  {/* Recência */}
                  <td className="py-2.5 px-3 text-center">
                    {item.diasSemComprar !== null ? (
                      <span className="font-mono text-muted-foreground font-medium">
                        {item.diasSemComprar} dias
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </td>

                  {/* Fat. Período */}
                  <td className="py-2.5 px-3 text-right font-mono font-medium text-foreground">
                    {formatCur(item.valorFaturadoPeriodo)}
                  </td>

                  {/* Fat. 12M */}
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {formatCur(item.valorFaturado12m)}
                  </td>

                  {/* Saúde / Status */}
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBadgeStyle(
                        item.classificacaoSaude
                      )}`}
                    >
                      {item.classificacaoSaude}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filteredData.length > 50 && (
        <p className="text-[11px] text-muted-foreground text-right font-medium">
          Exibindo os primeiros 50 clientes de {filteredData.length} encontrados.
        </p>
      )}
    </div>
  );
};
