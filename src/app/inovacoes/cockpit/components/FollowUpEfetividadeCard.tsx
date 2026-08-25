"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  TrendingUp,
  Target,
  Users,
  ShieldCheck,
  Building2,
  Layers,
  Info,
  DollarSign,
  Briefcase,
  ChevronRight,
  TrendingDown,
  Sparkles,
  BarChart3,
} from "lucide-react";
import type {
  FollowUpEfetividadeAnalyticsData,
  RpsGapRecoveryAnalyticsData,
  RpsGapRecoveryActionDetail,
} from "@/lib/governance/analytics";

interface FollowUpEfetividadeCardProps {
  data?: FollowUpEfetividadeAnalyticsData;
  loading?: boolean;
}

const ORIGEM_LABELS: Record<string, string> = {
  COCKPIT_PRESCRITIVO: "Cockpit Prescritivo",
  RPS_COMPROMISSO: "Compromisso RPS",
  ALERTA_QUEDA: "Alerta de Queda",
  RANKING_PERFORMANCE: "Ranking Performance",
  MANUAL: "Ação Manual",
};

export const FollowUpEfetividadeCard: React.FC<FollowUpEfetividadeCardProps> = ({
  data,
  loading = false,
}) => {
  const [activeTab, setActiveTab] = useState<"RPS_GAP" | "ORIGEM" | "GERENTE">("RPS_GAP");

  const formatCur = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const formatPct = (val: number) => `${Number(val || 0).toFixed(1)}%`;

  // Dados Globais de Efetividade (AnalyticsEngine)
  const totalElegiveis = data?.totalElegiveisCount || 0;
  const clientesRecuperados = data?.clientesRecuperadosCount || 0;
  const faturamentoRecuperado = data?.faturamentoRecuperadoTotal || 0;
  const taxaEfetividade = data?.taxaEfetividade || 0;
  const porOrigem = data?.efetividadePorOrigem || [];
  const porGerente = data?.rankingGerentesEfetividade || [];

  // Dados Oficiais de Recuperação de GAP RPS (P3.6C.2 / P3.6D)
  const rpsData: RpsGapRecoveryAnalyticsData | undefined = data?.rpsGapRecovery;
  const rpsAcoesCount = rpsData?.acoesCount || 0;
  const rpsGapOriginal = rpsData?.gapOriginalTotal || 0;
  const rpsGapRecuperado = rpsData?.gapRecuperadoTotal || 0;
  const rpsGapRemanescente = rpsData?.gapRemanescenteTotal || 0;
  const rpsTaxaRecuperacao = rpsData?.taxaRecuperacaoGapPct || 0;
  const rpsDetalhes: RpsGapRecoveryActionDetail[] = rpsData?.detalhesAcoes || [];

  const hasGeneralData = totalElegiveis > 0 || faturamentoRecuperado > 0;
  const hasRpsData = rpsAcoesCount > 0 && rpsGapOriginal > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-5 group hover:border-gold/40 transition-all">
      {/* Header do Card com Seletor de Visões Executivas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gold/10 text-gold border border-gold/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground">
                Efetividade do Follow-up Comercial
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Auditoria 30D
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Receita comercial oficial recuperada pós-conclusão das ações prescritivas
            </p>
          </div>
        </div>

        {/* Seletor de visualização (RPS GAP / Origem / Gerente) */}
        {!loading && (
          <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("RPS_GAP")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "RPS_GAP"
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Recuperação GAP RPS</span>
              {rpsAcoesCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === "RPS_GAP"
                      ? "bg-black/20 text-gold-foreground"
                      : "bg-gold/20 text-gold"
                  }`}
                >
                  {rpsAcoesCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ORIGEM")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ORIGEM"
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Origem</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("GERENTE")}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "GERENTE"
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Gerente</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: RECUPERAÇÃO DE GAP RPS (P3.6D)                                      */}
      {/* ========================================================================= */}
      {activeTab === "RPS_GAP" && (
        <div className="space-y-4">
          {/* Header da Seção GAP RPS */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-gold" />
                <span>Recuperação de GAP RPS</span>
              </h4>
              <span className="text-[11px] text-muted-foreground">
                (Compromissos de Dispersão Comercial)
              </span>
            </div>
            {rpsAcoesCount > 0 && !loading && (
              <span className="text-[11px] font-mono text-muted-foreground">
                {rpsAcoesCount} {rpsAcoesCount === 1 ? "ação concluída" : "ações concluídas"}
              </span>
            )}
          </div>

          {/* Grid de KPIs do GAP RPS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: GAP RPS Original */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>GAP RPS Original</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              {loading ? (
                <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : !hasRpsData ? (
                <div className="text-2xl font-black text-muted-foreground/60 font-mono tracking-tight pt-1">
                  —
                </div>
              ) : (
                <div className="text-2xl font-black text-amber-400 font-mono tracking-tight pt-1">
                  {formatCur(rpsGapOriginal)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Desvio financeiro total acordado no RPS
              </p>
            </div>

            {/* KPI 2: GAP Recuperado */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>GAP Recuperado</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              {loading ? (
                <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : !hasRpsData ? (
                <div className="text-2xl font-black text-muted-foreground/60 font-mono tracking-tight pt-1">
                  —
                </div>
              ) : (
                <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight pt-1">
                  {formatCur(rpsGapRecuperado)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Faturamento oficial gerado pós-conclusão (30D)
              </p>
            </div>

            {/* KPI 3: GAP Remanescente */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>GAP Remanescente</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              {loading ? (
                <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : !hasRpsData ? (
                <div className="text-2xl font-black text-muted-foreground/60 font-mono tracking-tight pt-1">
                  —
                </div>
              ) : (
                <div className="text-2xl font-black text-rose-400 font-mono tracking-tight pt-1">
                  {formatCur(rpsGapRemanescente)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Saldo de gap a recuperar (por ação)
              </p>
            </div>

            {/* KPI 4: % GAP Recuperado */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>% GAP Recuperado</span>
                <Target className="w-4 h-4 text-gold" />
              </div>
              {loading ? (
                <div className="h-7 w-20 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : !hasRpsData ? (
                <div className="text-2xl font-black text-muted-foreground/60 font-mono tracking-tight pt-1">
                  —
                </div>
              ) : (
                <div className="text-2xl font-black text-gold font-mono tracking-tight pt-1">
                  {formatPct(rpsTaxaRecuperacao)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {rpsAcoesCount} {rpsAcoesCount === 1 ? "ação no escopo" : "ações no escopo"}
              </p>
            </div>
          </div>

          {/* Tabela de Detalhamento Executivo por Ação RPS */}
          {loading ? (
            <div className="h-28 bg-muted/20 animate-pulse rounded-xl" />
          ) : !hasRpsData ? (
            <div className="bg-background/40 border border-border/40 rounded-xl p-6 text-center text-xs text-muted-foreground space-y-1">
              <Info className="w-5 h-5 mx-auto text-muted-foreground/60 mb-1" />
              <p className="font-semibold text-foreground">
                Nenhum compromisso RPS concluído com GAP financeiro auditável no período.
              </p>
              <p className="text-[11px]">
                Os compromissos de dispersão criados na RPS serão conciliados automaticamente aqui nos 30 dias posteriores à sua conclusão.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Detalhamento das Ações RPS Concluídas
              </h5>
              <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/30 text-[10px] text-muted-foreground uppercase font-bold border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-3">Cliente / Conta</th>
                      <th className="py-2.5 px-3">Gerente</th>
                      <th className="py-2.5 px-3 text-right">GAP Original</th>
                      <th className="py-2.5 px-3 text-right">Recuperado</th>
                      <th className="py-2.5 px-3 text-right">Remanescente</th>
                      <th className="py-2.5 px-3 text-right">% Recuperado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {rpsDetalhes.map((act) => {
                      const isMetaAtingida = act.taxaRecuperacaoPct >= 100;
                      return (
                        <tr key={act.actionId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-sans font-semibold text-foreground">
                            {act.clienteNome}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-muted-foreground">
                            {act.managerName}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                            {formatCur(act.gapOriginal)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                            {formatCur(act.faturamentoRecuperado)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-rose-400">
                            {formatCur(act.gapRemanescente)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isMetaAtingida
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-gold/10 text-gold border border-gold/20"
                              }`}
                            >
                              {isMetaAtingida && <CheckCircle2 className="w-2.5 h-2.5" />}
                              {formatPct(act.taxaRecuperacaoPct)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2 & 3: VISÃO GERAL POR ORIGEM E POR GERENTE (COMPATIBILIDADE P3.5)    */}
      {/* ========================================================================= */}
      {activeTab !== "RPS_GAP" && (
        <div className="space-y-5">
          {/* Grid Principal de KPIs Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Faturamento Recuperado */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Faturamento Recuperado</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              {loading ? (
                <div className="h-7 w-32 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : (
                <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight pt-1">
                  {formatCur(faturamentoRecuperado)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                NFes oficiais emitidas pós-conclusão
              </p>
            </div>

            {/* KPI 2: Taxa de Efetividade */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Taxa de Efetividade</span>
                <Target className="w-4 h-4 text-gold" />
              </div>
              {loading ? (
                <div className="h-7 w-20 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : (
                <div className="text-2xl font-black text-gold font-mono tracking-tight pt-1">
                  {formatPct(taxaEfetividade)}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Ações com recompra confirmada
              </p>
            </div>

            {/* KPI 3: Ações Concluídas */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Ações Concluídas</span>
                <Briefcase className="w-4 h-4 text-sky-400" />
              </div>
              {loading ? (
                <div className="h-7 w-16 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : (
                <div className="text-2xl font-black text-foreground font-mono tracking-tight pt-1">
                  {totalElegiveis}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Ações no escopo elegível de auditoria
              </p>
            </div>

            {/* KPI 4: Clientes Recuperados */}
            <div className="bg-background/60 border border-border/60 rounded-xl p-4 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold">
                <span>Clientes Recuperados</span>
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              {loading ? (
                <div className="h-7 w-16 bg-muted/40 animate-pulse rounded-lg mt-2" />
              ) : (
                <div className="text-2xl font-black text-purple-400 font-mono tracking-tight pt-1">
                  {clientesRecuperados}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Clientes reativados com faturamento
              </p>
            </div>
          </div>

          {/* Breakdown por Origem */}
          {activeTab === "ORIGEM" && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gold" />
                <span>Resultado Consolidado por Origem</span>
              </h4>
              {!hasGeneralData && !loading ? (
                <div className="bg-background/40 border border-border/40 rounded-xl p-6 text-center text-xs text-muted-foreground">
                  Nenhuma ação de follow-up concluída com faturamento conciliado no período.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {porOrigem.map((item) => (
                    <div
                      key={item.origem}
                      className="bg-background/40 border border-border/60 rounded-xl p-3 space-y-2 hover:border-gold/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {ORIGEM_LABELS[item.origem] || item.origem}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-gold">
                          {formatPct(item.taxaEfetividade)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-border/40 text-xs">
                        <span className="text-muted-foreground text-[11px]">Recuperado:</span>
                        <strong className="text-emerald-400 font-mono">
                          {formatCur(item.faturamentoRecuperado)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Reativados: {item.recuperadosCount}</span>
                        <span>Total Concluídas: {item.elegiveisCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Breakdown por Gerente */}
          {activeTab === "GERENTE" && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gold" />
                <span>Efetividade por Gerente Responsável</span>
              </h4>
              {!hasGeneralData && !loading ? (
                <div className="bg-background/40 border border-border/40 rounded-xl p-6 text-center text-xs text-muted-foreground">
                  Nenhuma ação de follow-up concluída com faturamento conciliado no período.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {porGerente.map((item) => (
                    <div
                      key={item.managerName}
                      className="bg-background/40 border border-border/60 rounded-xl p-3 space-y-2 hover:border-gold/30 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground truncate">
                          {item.managerName}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-gold">
                          {formatPct(item.taxaEfetividade)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between pt-1 border-t border-border/40 text-xs">
                        <span className="text-muted-foreground text-[11px]">Recuperado:</span>
                        <strong className="text-emerald-400 font-mono">
                          {formatCur(item.faturamentoRecuperado)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Reativados: {item.recuperadosCount}</span>
                        <span>Total: {item.elegiveisCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nota de Governança Oficial */}
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground/80 bg-muted/20 border border-border/40 rounded-xl p-3">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <span>
          <strong>Governança Financeira Oficial:</strong> Faturamento recuperado e reconciliação de GAP RPS
          representam a receita líquida das notas fiscais comerciais emitidas nos 30 dias posteriores à conclusão
          da ação, apurada pela <code className="text-foreground font-mono text-[10px]">AnalyticsEngine V1</code> via{" "}
          <code className="text-foreground font-mono text-[10px]">vw_faturamento_comercial_oficial</code> com TOPs permitidas,
          máquina anti-duplicidade e desvio financeiro de 0,0000%.
        </span>
      </div>
    </div>
  );
};
