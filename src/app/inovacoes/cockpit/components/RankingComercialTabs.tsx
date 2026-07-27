"use client";

import React, { useState } from "react";
import { Trophy, Building, Users, UserCheck, Award } from "lucide-react";
import { CockpitComercialData } from "@/lib/governance/analytics/engine";

interface RankingComercialTabsProps {
  ranking: CockpitComercialData["ranking"];
  loading?: boolean;
}

export const RankingComercialTabs: React.FC<RankingComercialTabsProps> = ({
  ranking,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<"redes" | "clientes" | "gerentes">("redes");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gold/10 text-gold">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Ranking Comercial</h3>
            <p className="text-[11px] text-muted-foreground">
              Desempenho relativo por Rede (Rolling FAT 3M), Cliente e Gerente
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("redes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "redes"
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Redes (Rolling 3M)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clientes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "clientes"
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Top Clientes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("gerentes")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "gerentes"
                ? "bg-gold text-gold-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Gerentes
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="overflow-x-auto rounded-xl border border-border">
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Carregando rankings comerciais...
          </div>
        ) : (
          <>
            {/* Aba 1: REDES */}
            {activeTab === "redes" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Rede / Matriz</th>
                    <th className="py-2.5 px-3 text-right">Rolling FAT 3M</th>
                    <th className="py-2.5 px-3 text-right">% Share</th>
                    <th className="py-2.5 px-3 w-36">Distribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ranking.redes.map((item, idx) => (
                    <tr
                      key={`${item.rede}-${idx}`}
                      className={`hover:bg-muted/30 transition-colors ${
                        item.rede.toUpperCase() === "OUTROS" ? "bg-muted/20 italic text-muted-foreground" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-gold">
                        {item.rankingPosition}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {item.rede}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatCur(item.rollingFat3m)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {item.share.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-gold h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, item.share))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Aba 2: CLIENTES */}
            {activeTab === "clientes" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Cliente / Parceiro</th>
                    <th className="py-2.5 px-3 text-right">Faturamento Período</th>
                    <th className="py-2.5 px-3 text-right">% Share</th>
                    <th className="py-2.5 px-3 w-36">Distribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ranking.clientes.map((item, idx) => (
                    <tr key={`${item.nomeParceiro}-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-gold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground truncate max-w-[250px]">
                        {item.nomeParceiro}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatCur(item.faturamento)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {item.share.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, item.share))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Aba 3: GERENTES */}
            {activeTab === "gerentes" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase font-semibold text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3">Gerente Responsável</th>
                    <th className="py-2.5 px-3 text-right">Faturamento Período</th>
                    <th className="py-2.5 px-3 text-right">% Share</th>
                    <th className="py-2.5 px-3 w-36">Distribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ranking.gerentes.map((item, idx) => (
                    <tr key={`${item.manager}-${idx}`} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-gold">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">
                        {item.manager}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                        {formatCur(item.faturamento)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {item.share.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="w-full bg-muted/60 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(2, item.share))}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};
