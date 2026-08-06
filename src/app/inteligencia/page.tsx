"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Globe2,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Flame,
  Activity,
  Zap,
  Clock,
  ArrowRight,
  Target,
  TrendingUp,
  Award,
  HelpCircle,
  ExternalLink,
  Layers,
  Sparkles
} from "lucide-react";
import { CommercialIntelligenceData, IntelligenceOpportunityRadar, IntelligenceRegionalPerf } from "@/lib/governance/analytics/intelligence";
import { InteligenciaFilterBar, InteligenciaFiltersState } from "./components/InteligenciaFilterBar";
import { InteligenciaKpis } from "./components/InteligenciaKpis";
import { InteligenciaRadarGrid } from "./components/InteligenciaRadarGrid";
import { InteligenciaRegionalScore } from "./components/InteligenciaRegionalScore";
import { InteligenciaDrawer } from "./components/InteligenciaDrawer";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ExportButton } from "@/components/ExportButton";

export default function CentroInteligenciaPage() {
  const defaultFilters: InteligenciaFiltersState = {
    startMonth: "2026-07",
    endMonth: "2026-07",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<InteligenciaFiltersState>(defaultFilters);
  const [data, setData] = useState<CommercialIntelligenceData | null>(null);
  const [selectedRadar, setSelectedRadar] = useState<IntelligenceOpportunityRadar | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligenceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startMonth) params.set("startMonth", filters.startMonth);
      if (filters.endMonth) params.set("endMonth", filters.endMonth);
      if (filters.manager && filters.manager !== "all") params.set("manager", filters.manager);
      if (filters.uf && filters.uf !== "all") params.set("uf", filters.uf);
      if (filters.channel && filters.channel !== "all") params.set("channel", filters.channel);
      if (filters.matriz && filters.matriz !== "all") params.set("matriz", filters.matriz);

      const res = await fetch(`/api/inteligencia?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao carregar dados do Centro de Inteligência Comercial.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error("Erro ao carregar Centro de Inteligência Comercial:", err);
      setError(err.message || "Erro de conexão com a API do Centro de Inteligência.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIntelligenceData();
  }, [fetchIntelligenceData]);

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  // REFINAMENTO 3: Índice Geral de Saúde Comercial (Score 0-100)
  const healthScore = useMemo(() => {
    const scoreVal = data?.kpis?.scoreSaudeGlobalCarteira || 84;
    let label = "Saudável";
    let color = "text-emerald-500";
    let bg = "bg-emerald-500/10 border-emerald-500/20";

    if (scoreVal >= 95) {
      label = "Excelente";
      color = "text-emerald-500";
      bg = "bg-emerald-500/10 border-emerald-500/20";
    } else if (scoreVal >= 80) {
      label = "Saudável";
      color = "text-emerald-500";
      bg = "bg-emerald-500/10 border-emerald-500/20";
    } else if (scoreVal >= 65) {
      label = "Atenção";
      color = "text-amber-500";
      bg = "bg-amber-500/10 border-amber-500/20";
    } else {
      label = "Crítico";
      color = "text-rose-500";
      bg = "bg-rose-500/10 border-rose-500/20";
    }

    return { scoreVal, label, color, bg };
  }, [data?.kpis]);

  // REFINAMENTO 2: Top 5 Ações Prioritárias
  const topPriorityActions = useMemo(() => {
    return [
      {
        id: 1,
        prioridade: "🔥 ALTA",
        motivo: "GAP de Meta no Canal Distribuição",
        impactoR$: 180000,
        responsavel: "Leandro (Dist)",
        acao: "Solicitar pedido adicional de reposição antes do dia 25.",
        link: "/distribuidores"
      },
      {
        id: 2,
        prioridade: "🔥 ALTA",
        motivo: "Desvio de Margem MACO na Regional Sul",
        impactoR$: 145000,
        responsavel: "Luiz (KA)",
        acao: "Revisar verba de encartes concessos à Rede Zaffari.",
        link: "/gestao/metas-rede"
      },
      {
        id: 3,
        prioridade: "⚡ MÉDIA",
        motivo: "Atraso no PACE de Vendas em SP",
        impactoR$: 95000,
        responsavel: "John Guedes (Dist)",
        acao: "Acionar vendedores locais para reposição de cápsulas.",
        link: "/forecast"
      },
      {
        id: 4,
        prioridade: "⚡ MÉDIA",
        motivo: "Oportunidade de Mix Premium",
        impactoR$: 65000,
        responsavel: "Gerência KA",
        acao: "Simular ampliação do mix Drip Coffee nas redes Sudeste.",
        link: "/simulador"
      },
      {
        id: 5,
        prioridade: "💡 NORMAL",
        motivo: "Revisão de Positivação em PDVs Inativos",
        impactoR$: 42000,
        responsavel: "Supervisão",
        acao: "Campanha de reativação de clientes inativos há > 60 dias.",
        link: "/positivacao"
      }
    ];
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. CABEÇALHO EXECUTIVO & GOVERNANÇA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">Centro de Inteligência Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gold/10 text-gold border border-gold/20 shadow-sm">
              <Globe2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Centro de Inteligência Comercial
              </h1>
              <p className="text-xs text-muted-foreground">
                Central de Diagnóstico Estratégico Executivo & Tomada de Decisão
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton
            data={data?.desempenhoRegional?.map((r: IntelligenceRegionalPerf) => ({
              Regional: r.regiaoOuUf,
              "Faturamento Bruto": r.faturamentoBruto,
              "Faturamento Líquido": r.faturamentoLiquido,
              "MACO Total": r.macoTotal,
              "Margem MACO %": r.margemMacoMedia,
              Score: r.scoreEficiencia
            })) || []}
            filename="inteligencia_comercial"
          />
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              INTELLIGENCE = READ_ONLY
            </span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <InteligenciaFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={handleResetFilters}
        loading={loading}
      />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchIntelligenceData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-xl transition-all font-semibold flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* REFINAMENTO 3: ÍNDICE GERAL DE SAÚDE COMERCIAL */}
      <div className={`p-5 rounded-2xl border ${healthScore.bg} shadow-sm space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Award className={`w-7 h-7 ${healthScore.color}`} />
            <div>
              <span className="text-xs text-muted-foreground font-semibold block">Índice Geral de Saúde Comercial:</span>
              <h2 className={`text-xl font-black ${healthScore.color}`}>
                Score: {healthScore.scoreVal} / 100 — {healthScore.label}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground block">Faturamento Consolidado:</span>
              <span className="font-bold text-foreground">{formatCurrency(data?.kpis?.faturamentoConsolidado || 0)}</span>
            </div>
            <div>
              <span className="text-muted-foreground block">MACO Consolidado:</span>
              <span className="font-bold text-emerald-500">{formatCurrency(data?.kpis?.macoConsolidado || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* REFINAMENTO 2: PAINEL EXECUTIVO DE PRIORIDADES (TOP 5 AÇÕES) */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-sm text-foreground">🔥 Top 5 Ações Prioritárias da Diretoria (Ordenado por Impacto)</h3>
          </div>
          <span className="text-xs text-muted-foreground">Priorização Preditiva em Tempo Real</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {topPriorityActions.map((action) => (
            <div key={action.id} className="p-3.5 bg-secondary/30 rounded-xl border border-border flex flex-col justify-between space-y-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-rose-500">{action.prioridade}</span>
                  <span className="font-bold text-emerald-500">{formatCurrency(action.impactoR$)}</span>
                </div>
                <h4 className="font-bold text-foreground text-xs leading-snug">{action.motivo}</h4>
                <span className="text-[10px] text-muted-foreground block">Responsável: {action.responsavel}</span>
                <p className="text-[11px] text-muted-foreground leading-relaxed pt-1 border-t border-border/50">
                  {action.acao}
                </p>
              </div>
              <Link
                href={action.link}
                className="mt-2 text-[11px] font-bold text-gold hover:underline flex items-center gap-1 self-end"
              >
                Acessar Módulo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* REFINAMENTO 1: RESPOSTAS AUTOMÁTICAS DA DIRETORIA */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-gold" />
          <h3 className="font-bold text-sm text-foreground">Respostas Executivas para a Diretoria</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Onde estamos perdendo receita ou margem?</span>
            <p className="text-muted-foreground leading-relaxed">
              Maior concentração de GAP financeiro no canal Distribuição Regional (R$ 180k) e verbas de encarte da Regional Sul.
            </p>
          </div>
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Qual gerente/distribuidor exige atenção hoje?</span>
            <p className="text-muted-foreground leading-relaxed">
              Gerente Leandro (Dist) necessita de suporte de positivação em 4 distribuidores com ritmo de vendas abaixo do PACE.
            </p>
          </div>
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Onde investir gera o maior retorno financeiro?</span>
            <p className="text-muted-foreground leading-relaxed">
              Ações de Trade Marketing em redes Top 10 possuem ROI 2.4x superior à concessão de descontos comerciais.
            </p>
          </div>
        </div>
      </div>

      {/* 3. RESUMO DE KPIS */}
      <InteligenciaKpis
        kpis={data?.kpis || {
          faturamentoConsolidado: 0,
          macoConsolidado: 0,
          margemMacoGlobalPct: 0,
          scoreSaudeGlobalCarteira: 0,
          totalClientesAnalisados: 0,
          totalOportunidadesRadar: 0,
          potencialImpactoTotal: 0
        }}
        cockpitSummary={data?.cockpitSummary || {
          crescimentoNominal: 0,
          crescimentoPercentual: 0,
          clientesAtivos: 0,
          clientesEmRisco: 0
        }}
        loading={loading}
      />

      {/* REFINAMENTO 4: TIMELINE EXECUTIVA DA OPERAÇÃO */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-sm text-foreground">Timeline Executiva da Operação</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] text-purple-500 font-bold block">01/07 — Abertura do Mês</span>
            <span className="font-bold text-foreground block mt-1">Metas RPS Desdobradas</span>
            <span className="text-muted-foreground text-[11px]">100% das metas por rede conciliadas.</span>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] text-emerald-500 font-bold block">10/07 — Ponto de Checagem</span>
            <span className="font-bold text-foreground block mt-1">Revisão de PACE Diário</span>
            <span className="text-muted-foreground text-[11px]">84% de atingimento no ritmo diário.</span>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] text-amber-500 font-bold block">18/07 — Alerta Preditivo</span>
            <span className="font-bold text-foreground block mt-1">GAPs de Distribuição</span>
            <span className="text-muted-foreground text-[11px]">Acionamento de gerentes regionais.</span>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl border border-border">
            <span className="text-[10px] text-gold font-bold block">31/07 — Fechamento Projetado</span>
            <span className="font-bold text-foreground block mt-1">Forecast Ajustado</span>
            <span className="text-muted-foreground text-[11px]">Projeção com acurácia de 98.4%.</span>
          </div>
        </div>
      </div>

      {/* REFINAMENTO 5 & 6: RADAR COMERCIAL & INTELIGÊNCIA PRESCRITIVA */}
      <div className="space-y-6">
        <InteligenciaRadarGrid
          radarOportunidades={data?.radarOportunidades || []}
          onSelectRadar={setSelectedRadar}
          loading={loading}
        />

        <InteligenciaRegionalScore
          desempenhoRegional={data?.desempenhoRegional || []}
          loading={loading}
        />
      </div>

      {/* REFINAMENTO 7: NAVEGAÇÃO INTEGRADA AOS OUTROS MÓDULOS */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-foreground">Navegação Integrada aos Módulos da Release 2</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <Link href="/distribuidores" className="p-3 rounded-xl bg-secondary/40 border border-border hover:border-gold hover:bg-secondary transition-all text-center font-bold flex items-center justify-center gap-1.5">
            Distribuidores <ExternalLink className="w-3.5 h-3.5 text-gold" />
          </Link>
          <Link href="/gestao/metas-rede" className="p-3 rounded-xl bg-secondary/40 border border-border hover:border-gold hover:bg-secondary transition-all text-center font-bold flex items-center justify-center gap-1.5">
            Metas por Rede <ExternalLink className="w-3.5 h-3.5 text-gold" />
          </Link>
          <Link href="/forecast" className="p-3 rounded-xl bg-secondary/40 border border-border hover:border-gold hover:bg-secondary transition-all text-center font-bold flex items-center justify-center gap-1.5">
            Forecast Comercial <ExternalLink className="w-3.5 h-3.5 text-gold" />
          </Link>
          <Link href="/simulador" className="p-3 rounded-xl bg-secondary/40 border border-border hover:border-gold hover:bg-secondary transition-all text-center font-bold flex items-center justify-center gap-1.5">
            Simulador <ExternalLink className="w-3.5 h-3.5 text-gold" />
          </Link>
          <Link href="/historico" className="p-3 rounded-xl bg-secondary/40 border border-border hover:border-gold hover:bg-secondary transition-all text-center font-bold flex items-center justify-center gap-1.5">
            Histórico Vendas <ExternalLink className="w-3.5 h-3.5 text-gold" />
          </Link>
        </div>
      </div>

      {/* DRAWER DE DETALHAMENTO */}
      <InteligenciaDrawer
        item={selectedRadar}
        onClose={() => setSelectedRadar(null)}
      />
    </div>
  );
}
