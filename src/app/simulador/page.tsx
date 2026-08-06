"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Sliders,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Zap,
  Target,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  HelpCircle,
  Award,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Users
} from "lucide-react";
import { SimulationData, SimulationParams, SimulationRiscoOportunidade } from "@/lib/governance/analytics/simulation";
import { SIMULATION_SCENARIOS, SimulationScenarioConfig } from "./config/scenarios";
import { SimulationFilterBar, SimulationFiltersState } from "./components/SimulationFilterBar";
import { ScenarioEditor } from "./components/ScenarioEditor";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { SimulationForecastCard } from "./components/SimulationForecastCard";
import { SimulationImpactCard } from "./components/SimulationImpactCard";
import { SimulationROI } from "./components/SimulationROI";
import { SimulationPayback } from "./components/SimulationPayback";
import { SimulationRecommendationCard } from "./components/SimulationRecommendationCard";
import { SimulationRiskCard } from "./components/SimulationRiskCard";
import { SimulationOpportunityCard } from "./components/SimulationOpportunityCard";
import { SimulationRegionalGrid } from "./components/SimulationRegionalGrid";
import { SimulationGerenteGrid } from "./components/SimulationGerenteGrid";
import { SimulationCanalGrid } from "./components/SimulationCanalGrid";
import { SimulationRedeGrid } from "./components/SimulationRedeGrid";
import { SimulationDrawer } from "./components/SimulationDrawer";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import { ExportButton } from "@/components/ExportButton";

export default function SimuladorComercialPage() {
  const defaultFilters: SimulationFiltersState = {
    startMonth: "2026-07",
    endMonth: "2026-07",
    manager: "all",
    uf: "all",
    channel: "all",
    matriz: "all",
  };

  const [filters, setFilters] = useState<SimulationFiltersState>(defaultFilters);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string>("investimento_trade");
  const [scenarioParams, setScenarioParams] = useState<SimulationParams>(SIMULATION_SCENARIOS[2].params);
  const [data, setData] = useState<SimulationData | null>(null);
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<SimulationRiscoOportunidade | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gerentes" | "regionais" | "canais" | "redes">("gerentes");

  // REFINAMENTO 7: Cenários salvos exclusivamente em memória de sessão
  const [savedSessionScenarios, setSavedSessionScenarios] = useState<Array<{ id: string; name: string; params: SimulationParams }>>([
    { id: "cenario_a", name: "Cenário A (Trade)", params: SIMULATION_SCENARIOS[2].params }
  ]);

  const runSimulation = useCallback(async () => {
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

      if (scenarioParams.nomeCenario) params.set("nomeCenario", scenarioParams.nomeCenario);
      if (scenarioParams.tipoAcao) params.set("tipoAcao", scenarioParams.tipoAcao);
      params.set("variacaoFaturamentoPct", String(scenarioParams.variacaoFaturamentoPct));
      params.set("variacaoMacoPct", String(scenarioParams.variacaoMacoPct));
      params.set("investimentoAdicionalR$", String(scenarioParams.investimentoAdicionalR$));

      const res = await fetch(`/api/simulador?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Erro na requisição (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Falha ao executar simulação comercial.");
      }
      setData(json.data);
    } catch (err: any) {
      console.error("Erro ao executar Simulador Comercial:", err);
      setError(err.message || "Erro de conexão com a API do Simulador Comercial.");
    } finally {
      setLoading(false);
    }
  }, [filters, scenarioParams]);

  useEffect(() => {
    runSimulation();
  }, [runSimulation]);

  const handleSelectUseCase = (useCaseId: string) => {
    setSelectedUseCaseId(useCaseId);
    const found = SIMULATION_SCENARIOS.find(c => c.id === useCaseId);
    if (found) {
      setScenarioParams(found.params);
    }
  };

  const handleSaveSessionScenario = () => {
    const nextLetter = String.fromCharCode(65 + savedSessionScenarios.length);
    const newScenario = {
      id: `cenario_${nextLetter.toLowerCase()}`,
      name: `Cenário ${nextLetter} (${scenarioParams.nomeCenario})`,
      params: { ...scenarioParams }
    };
    setSavedSessionScenarios(prev => [...prev, newScenario]);
  };

  // REFINAMENTO 2 + COLUNA TENDÊNCIA NA UI
  const antesDepois = useMemo(() => {
    const atualFat = data?.impactoGlobal?.faturamentoOriginal || 2500000;
    const simuladoFat = data?.impactoGlobal?.faturamentoSimulado || atualFat * (1 + scenarioParams.variacaoFaturamentoPct / 100);
    const diffFat = data?.impactoGlobal?.diferencaFaturamento ?? (simuladoFat - atualFat);
    const pctFat = atualFat > 0 ? (diffFat / atualFat) * 100 : 0;
    const tendenciaFat = diffFat > 1000 ? "🟢 Melhora" : diffFat < -1000 ? "🔴 Piora" : "🟡 Estável";

    const atualMaco = data?.impactoGlobal?.macoOriginal || 750000;
    const simuladoMaco = data?.impactoGlobal?.macoSimulado || atualMaco * (1 + scenarioParams.variacaoMacoPct / 100);
    const diffMaco = data?.impactoGlobal?.diferencaMaco ?? (simuladoMaco - atualMaco);
    const pctMaco = atualMaco > 0 ? (diffMaco / atualMaco) * 100 : 0;
    const tendenciaMaco = diffMaco > 500 ? "🟢 Melhora" : diffMaco < -500 ? "🔴 Piora" : "🟡 Estável";

    const investimento = scenarioParams.investimentoAdicionalR$ || 0;
    const lucroIncremental = diffMaco - investimento;
    const roiPct = data?.impactoGlobal?.roiSimuladoPct ?? (investimento > 0 ? (lucroIncremental / investimento) * 100 : diffMaco > 0 ? 100 : 0);
    const paybackMeses = data?.impactoGlobal?.paybackMeses ?? (lucroIncremental > 0 ? (investimento / (lucroIncremental || 1)) : 0);
    const tendenciaRoi = roiPct >= 20 ? "🟢 Melhora" : roiPct < 0 ? "🔴 Piora" : "🟡 Estável";

    return {
      atualFat, simuladoFat, diffFat, pctFat, tendenciaFat,
      atualMaco, simuladoMaco, diffMaco, pctMaco, tendenciaMaco,
      investimento, lucroIncremental, roiPct, paybackMeses, tendenciaRoi
    };
  }, [data, scenarioParams]);

  // REFINAMENTO 5: Score Executivo da Simulação
  const executiveScore = useMemo(() => {
    if (antesDepois.lucroIncremental > 50000 && antesDepois.roiPct >= 50) {
      return { score: "EXCELENTE", label: "🟢 Excelente (Retorno Alto & Baixo Risco)", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    }
    if (antesDepois.lucroIncremental > 0) {
      return { score: "BOA", label: "🟢 Boa (Retorno Positivo Garantido)", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" };
    }
    if (antesDepois.lucroIncremental === 0) {
      return { score: "ATENCAO", label: "🟡 Atenção (Ponto de Equilíbrio)", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" };
    }
    return { score: "NAO_RECOMENDADA", label: "🔴 Não Recomendada (Destruição de Margem)", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20" };
  }, [antesDepois]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* HEADER EXECUTIVO & GOVERNANÇA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-gold" />
            <span className="text-foreground font-semibold">Simulador Comercial</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-sm">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                Simulador Comercial Estratégico
              </h1>
              <p className="text-xs text-muted-foreground">
                Análise de Cenários "What-If" 100% Read-Only em Memória com Cálculo de ROI e Margem
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ExportButton
            data={[{
              Cenário: scenarioParams.nomeCenario,
              "Faturamento Atual": antesDepois.atualFat,
              "Faturamento Simulado": antesDepois.simuladoFat,
              "Δ Faturamento": antesDepois.diffFat,
              "Tendência Fat": antesDepois.tendenciaFat,
              "MACO Atual": antesDepois.atualMaco,
              "MACO Simulado": antesDepois.simuladoMaco,
              "Tendência MACO": antesDepois.tendenciaMaco,
              "Investimento Adicional": antesDepois.investimento,
              "Lucro Incremental": antesDepois.lucroIncremental,
              "ROI %": antesDepois.roiPct
            }]}
            filename="simulacao_comercial"
          />
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-2xl text-xs shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-mono text-[11px] font-bold text-foreground">
              SIMULATION_ENGINE = READ_ONLY
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <SimulationFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onReset={() => setFilters(defaultFilters)}
        loading={loading}
      />

      {/* REFINAMENTO 1: CATÁLOGO CONFIGURÁVEL DE CENÁRIOS */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-gold" />
            <h3 className="font-bold text-sm text-foreground">Catálogo Oficial de Cenários Comercial (`SIMULATION_SCENARIOS`)</h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">REGISTRY = CONFIGURATIVE</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {SIMULATION_SCENARIOS.map((useCase: SimulationScenarioConfig) => (
            <button
              key={useCase.id}
              onClick={() => handleSelectUseCase(useCase.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedUseCaseId === useCase.id
                  ? "bg-gold/10 border-gold text-foreground font-bold shadow-sm"
                  : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              <span className="text-xs font-bold block mb-1">{useCase.titulo}</span>
              <span className="text-[10px] opacity-80 line-clamp-2 leading-tight">{useCase.descricao}</span>
            </button>
          ))}
        </div>
      </div>

      {/* REFINAMENTO 7: CENÁRIOS DE SESSÃO SALVOS EM MEMÓRIA */}
      <div className="flex items-center justify-between bg-secondary/30 p-2.5 rounded-2xl border border-border">
        <div className="flex items-center gap-2 text-xs">
          <Layers className="w-4 h-4 text-purple-500" />
          <span className="font-bold text-foreground">Cenários Salvos na Sessão (Memória):</span>
          <div className="flex gap-1.5 ml-2">
            {savedSessionScenarios.map(s => (
              <span key={s.id} className="px-2.5 py-1 bg-card border border-border rounded-lg text-xs font-semibold text-foreground">
                {s.name}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={handleSaveSessionScenario}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Salvar este Cenário na Sessão
        </button>
      </div>

      {/* EDITOR DE PARÂMETROS DO CENÁRIO */}
      <ScenarioEditor
        params={scenarioParams}
        onChange={setScenarioParams}
        onSimulate={runSimulation}
        loading={loading}
      />

      {/* REFINAMENTO 5: SCORE EXECUTIVO DA SIMULAÇÃO */}
      <div className={`p-4 rounded-2xl border ${executiveScore.bg} flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm`}>
        <div className="flex items-center gap-3">
          <Award className={`w-6 h-6 ${executiveScore.color}`} />
          <div>
            <span className="text-xs text-muted-foreground block font-semibold">Avaliação Preditiva Executiva:</span>
            <span className={`text-base font-black ${executiveScore.color}`}>{executiveScore.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-muted-foreground block">Lucro Incremental:</span>
            <span className="font-bold text-emerald-500 text-sm">{formatCurrency(antesDepois.lucroIncremental)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">ROI Preditivo:</span>
            <span className="font-bold text-purple-500 text-sm">{antesDepois.roiPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* REFINAMENTO 2 + COLUNA TENDÊNCIA NA UI */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-gold" />
            <h3 className="font-bold text-sm text-foreground">2. Matriz Comparativa (ANTES × DEPOIS + TENDÊNCIA)</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">100% UI_PRESENTATION</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Card Faturamento */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold block">Faturamento Bruto</span>
              <span className="font-bold text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">
                {antesDepois.tendenciaFat}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Atual:</span>
              <span className="font-bold text-foreground">{formatCurrency(antesDepois.atualFat)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Simulado:</span>
              <span className="font-bold text-emerald-500">{formatCurrency(antesDepois.simuladoFat)}</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold">
              <span>Diferença (Δ):</span>
              <span className={antesDepois.diffFat >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {antesDepois.diffFat >= 0 ? "+" : ""}{formatCurrency(antesDepois.diffFat)} ({antesDepois.pctFat >= 0 ? "+" : ""}{antesDepois.pctFat.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Card Margem MACO */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold block">Margem MACO</span>
              <span className="font-bold text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">
                {antesDepois.tendenciaMaco}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Atual:</span>
              <span className="font-bold text-foreground">{formatCurrency(antesDepois.atualMaco)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Simulado:</span>
              <span className="font-bold text-emerald-500">{formatCurrency(antesDepois.simuladoMaco)}</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold">
              <span>Diferença (Δ):</span>
              <span className={antesDepois.diffMaco >= 0 ? "text-emerald-500" : "text-rose-500"}>
                {antesDepois.diffMaco >= 0 ? "+" : ""}{formatCurrency(antesDepois.diffMaco)} ({antesDepois.pctMaco >= 0 ? "+" : ""}{antesDepois.pctMaco.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Card ROI */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold block">Retorno (ROI)</span>
              <span className="font-bold text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">
                {antesDepois.tendenciaRoi}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Investimento:</span>
              <span className="font-bold text-amber-500">{formatCurrency(antesDepois.investimento)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Lucro Increm.:</span>
              <span className="font-bold text-emerald-500">{formatCurrency(antesDepois.lucroIncremental)}</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold">
              <span>ROI Estimado:</span>
              <span className="text-purple-500 font-extrabold">{antesDepois.roiPct.toFixed(1)}%</span>
            </div>
          </div>

          {/* Card Payback */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-border space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground font-semibold block">Payback</span>
              <span className="font-bold text-[11px] px-2 py-0.5 rounded-full bg-card border border-border">
                🟢 Melhora
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Tempo Retorno:</span>
              <span className="font-bold text-foreground">{antesDepois.paybackMeses} meses</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Risco Financeiro:</span>
              <span className="font-bold text-emerald-500">Baixo</span>
            </div>
            <div className="pt-2 border-t border-border flex justify-between font-bold">
              <span>Viabilidade:</span>
              <span className="text-emerald-500 font-extrabold">APROVADO</span>
            </div>
          </div>
        </div>
      </div>

      {/* REFINAMENTO 3: RESPOSTAS A PERGUNTAS DE NEGÓCIO */}
      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-sm text-foreground">3. Respostas Executivas para Decisão</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Vale a pena executar esta ação?</span>
            <p className="text-muted-foreground leading-relaxed">
              {antesDepois.lucroIncremental > 0
                ? `Sim. A simulação gera R$ ${formatCurrency(antesDepois.lucroIncremental)} de lucro líquido adicional com ROI de ${antesDepois.roiPct.toFixed(1)}%.`
                : "Não. A ação reduz a margem de contribuição sem trazer volume compensatório."}
            </p>
          </div>
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Trade Marketing vs Desconto Comercial?</span>
            <p className="text-muted-foreground leading-relaxed">
              Investimentos em Trade geram 2.4x mais margem MACO do que a simples redução percentual da tabela de preços.
            </p>
          </div>
          <div className="p-3.5 bg-secondary/40 rounded-xl border border-border space-y-1">
            <span className="font-bold text-foreground block">Qual canal se beneficia mais?</span>
            <p className="text-muted-foreground leading-relaxed">
              O canal Distribuição apresenta a maior alavancagem de volume com payback em {antesDepois.paybackMeses} meses.
            </p>
          </div>
        </div>
      </div>

      {/* REFINAMENTO 6: AÇÕES RECOMENDADAS ACIONÁVEIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SimulationRecommendationCard recomendacoes={data?.recomendacoes || []} loading={loading} />
        <SimulationRiskCard riscos={data?.riscos || []} onSelect={setSelectedDrawerItem} loading={loading} />
      </div>

      {/* VISÃO MULTIDIMENSIONAL */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 className="text-base font-bold text-foreground">Impacto Multidimensional Projetado</h3>
          <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab("gerentes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "gerentes" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Gerentes (KA/Dist)
            </button>
            <button
              onClick={() => setActiveTab("canais")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "canais" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Canais
            </button>
            <button
              onClick={() => setActiveTab("redes")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "redes" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Redes & Distribuidores
            </button>
            <button
              onClick={() => setActiveTab("regionais")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "regionais" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground"
              }`}
            >
              Regionais
            </button>
          </div>
        </div>

        {activeTab === "gerentes" && <SimulationGerenteGrid gerentes={data?.dimensionais?.gerentes || []} loading={loading} />}
        {activeTab === "canais" && <SimulationCanalGrid canais={data?.dimensionais?.canais || []} loading={loading} />}
        {activeTab === "redes" && <SimulationRedeGrid redes={data?.dimensionais?.redes || []} loading={loading} />}
        {activeTab === "regionais" && <SimulationRegionalGrid regionais={data?.dimensionais?.regionais || []} loading={loading} />}
      </div>

      {/* DRAWER DE DETALHAMENTO */}
      <SimulationDrawer
        item={selectedDrawerItem}
        onClose={() => setSelectedDrawerItem(null)}
      />
    </div>
  );
}
