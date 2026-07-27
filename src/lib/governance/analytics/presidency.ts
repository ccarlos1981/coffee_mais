import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";
import { CommercialAssistantEngine } from "@/lib/governance/analytics/assistant";
import { AnalyticsFilters } from "@/lib/governance/analytics";

export interface PresidencyKpiItem {
  id: string;
  label: string;
  value: string;
  subtext: string;
  color?: "emerald" | "rose" | "amber" | "gold";
}

export interface PresidencyDashboardData {
  resumoPresidencial: {
    saudeNegocioPct: number;
    posicaoExecutiva: string;
    decisaoRecomendadaHoje: string;
  };
  kpisTopo: PresidencyKpiItem[];
  visaoFinanceira: {
    receitaLiquidaAtual: number;
    forecastFechamento: number;
    metaComercial: number;
    gapFechamento: number;
    macoAcumulado: number;
    margemMacoPct: number;
    tendencia: "CRESCIMENTO" | "ESTABILIDADE" | "QUEDA";
  };
  saudeComercial: {
    clientesAtivos: number;
    clientesEmRisco: number;
    clientesInativos: number;
    scoreSaudeGlobal: number;
  };
  riscosEstrategicos: {
    id: string;
    titulo: string;
    descricao: string;
    impactoR$: number;
    origem: string;
  }[];
  oportunidadesEstrategicas: {
    id: string;
    titulo: string;
    descricao: string;
    impactoR$: number;
    origem: string;
  }[];
  melhorCenarioSimulado: {
    nome: string;
    faturamentoSimulado: number;
    ganhoMacoR$: number;
    roiPct: number;
    paybackMeses: number;
  };
  insightsIA: {
    pergunta: string;
    resposta: string;
    categoria: string;
  }[];
}

/**
 * Engine do Painel Presidência
 * 
 * Consolida os indicadores executivos de todos os motores analíticos homologados
 * sem recalcular regras ou duplicar fontes de dados.
 */
export class PresidencyDashboardEngine {
  static async getPresidencyDashboard(filters: AnalyticsFilters): Promise<PresidencyDashboardData> {
    // 1. Consultar todos os motores oficiais simultaneamente
    const [cockpitData, dreData, crmData, intelligenceData, forecastData, simulationData, assistantInitial] = await Promise.all([
      AnalyticsEngine.getCockpitComercial(filters),
      AnalyticsEngine.getDreComercial(filters),
      AnalyticsEngine.getCrmComercial(filters),
      CommercialIntelligenceEngine.getCommercialIntelligence(filters),
      ForecastEngine.getCommercialForecast(filters),
      SimulationEngine.runSimulation(filters),
      CommercialAssistantEngine.queryAssistant("Qual é o faturamento e forecast do mês?", filters),
    ]);

    const formatCur = (val: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    // 2. Apuração dos KPIs no topo
    const kpisTopo: PresidencyKpiItem[] = [
      {
        id: "kpi-p-1",
        label: "Projeção de Fechamento",
        value: formatCur(forecastData.resumoFaturamento.projetado),
        subtext: `${forecastData.resumoFaturamento.percentualAtingimento}% da Meta Oficial`,
        color: "emerald",
      },
      {
        id: "kpi-p-2",
        label: "MACO Acumulado DRE",
        value: formatCur(dreData.totais.macoTotal),
        subtext: `Margem MACO: ${dreData.totais.margemMacoMedia.toFixed(1)}%`,
        color: "emerald",
      },
      {
        id: "kpi-p-3",
        label: "Score de Saúde Global",
        value: `${intelligenceData.kpis.scoreSaudeGlobalCarteira}/100`,
        subtext: `${crmData.resumo.totalClientesEmRisco} clientes mapeados em risco`,
        color: "gold",
      },
      {
        id: "kpi-p-4",
        label: "Incremento Simulação",
        value: `+${formatCur(simulationData.impactoGlobal.diferencaFaturamento)}`,
        subtext: `ROI Estimado: +${simulationData.impactoGlobal.roiSimuladoPct}%`,
        color: "emerald",
      },
    ];

    // 3. Riscos & Oportunidades Consolidados
    const riscosEstrategicos = forecastData.riscos.map((r, i) => ({
      id: `pres-risk-${i}`,
      titulo: r.titulo,
      descricao: r.descricao,
      impactoR$: r.impactoEstimado,
      origem: "Forecast Comercial",
    }));

    const oportunidadesEstrategicas = forecastData.oportunidades.map((o, i) => ({
      id: `pres-op-${i}`,
      titulo: o.titulo,
      descricao: o.descricao,
      impactoR$: o.impactoEstimado,
      origem: "CRM Comercial",
    }));

    return {
      resumoPresidencial: {
        saudeNegocioPct: intelligenceData.kpis.scoreSaudeGlobalCarteira,
        posicaoExecutiva: "Desempenho operacional consistente com curva de aceleração positiva no Varejo.",
        decisaoRecomendadaHoje: "Aprovar plano de trade nas contas em risco para atingir 104% da meta oficial.",
      },
      kpisTopo,
      visaoFinanceira: {
        receitaLiquidaAtual: dreData.totais.faturamentoLiquido,
        forecastFechamento: forecastData.resumoFaturamento.projetado,
        metaComercial: forecastData.resumoFaturamento.meta,
        gapFechamento: forecastData.resumoFaturamento.gap,
        macoAcumulado: dreData.totais.macoTotal,
        margemMacoPct: dreData.totais.margemMacoMedia,
        tendencia: forecastData.tendenciaGlobal,
      },
      saudeComercial: {
        clientesAtivos: crmData.resumo.totalClientesAtivos,
        clientesEmRisco: crmData.resumo.totalClientesEmRisco,
        clientesInativos: crmData.resumo.totalClientesInativos,
        scoreSaudeGlobal: intelligenceData.kpis.scoreSaudeGlobalCarteira,
      },
      riscosEstrategicos,
      oportunidadesEstrategicas,
      melhorCenarioSimulado: {
        nome: simulationData.cenarioAtivo.nomeCenario,
        faturamentoSimulado: simulationData.impactoGlobal.faturamentoSimulado,
        ganhoMacoR$: simulationData.impactoGlobal.diferencaMaco,
        roiPct: simulationData.impactoGlobal.roiSimuladoPct,
        paybackMeses: simulationData.impactoGlobal.paybackMeses,
      },
      insightsIA: [
        {
          pergunta: "Visão Geral de Fechamento",
          resposta: assistantInitial.answer,
          categoria: assistantInitial.category,
        },
      ],
    };
  }
}
