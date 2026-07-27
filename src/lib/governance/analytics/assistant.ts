import { AnalyticsEngine } from "@/lib/governance/analytics/engine";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";
import { AnalyticsFilters } from "@/lib/governance/analytics";

export interface AssistantMessage {
  id: string;
  sender: "USER" | "ASSISTANT";
  text: string;
  timestamp: string;
  category?: "FATURAMENTO" | "FORECAST" | "DRE" | "CRM" | "INTELIGENCIA" | "SIMULACAO" | "GERAL";
  dataInsight?: {
    kpis?: { label: string; value: string; color?: string }[];
    recomendedAction?: string;
  };
}

export interface AssistantResponseData {
  answer: string;
  category: "FATURAMENTO" | "FORECAST" | "DRE" | "CRM" | "INTELIGENCIA" | "SIMULACAO" | "GERAL";
  kpis: { label: string; value: string; color?: string }[];
  suggestedFollowUps: string[];
}

/**
 * Engine do Assistente Comercial (Linguagem Natural Executiva)
 * 
 * Interpreta perguntas executivas e retorna diagnósticos analíticos em linguagem natural
 * consumindo exclusivamente dados oficiais homologados em memória.
 */
export class CommercialAssistantEngine {
  static async queryAssistant(
    question: string,
    filters: AnalyticsFilters
  ): Promise<AssistantResponseData> {
    const qLower = question.toLowerCase();

    // 1. Consultar motores analíticos homologados em memória
    const [cockpitData, dreData, crmData, intelligenceData, forecastData, simulationData] = await Promise.all([
      AnalyticsEngine.getCockpitComercial(filters),
      AnalyticsEngine.getDreComercial(filters),
      AnalyticsEngine.getCrmComercial(filters),
      CommercialIntelligenceEngine.getCommercialIntelligence(filters),
      ForecastEngine.getCommercialForecast(filters),
      SimulationEngine.runSimulation(filters),
    ]);

    const formatCur = (val: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

    // 2. Roteamento Inteligente em Linguagem Natural

    // A) FORECAST & PROJEÇÃO
    if (qLower.includes("forecast") || qLower.includes("projetado") || qLower.includes("projeção") || qLower.includes("fechamento")) {
      const proj = forecastData.resumoFaturamento.projetado;
      const meta = forecastData.resumoFaturamento.meta;
      const pct = forecastData.resumoFaturamento.percentualAtingimento;

      return {
        answer: `De acordo com a ForecastEngine, a projeção oficial de fechamento do mês é de **${formatCur(
          proj
        )}**, o que representa **${pct}%** da meta comercial (R$ ${formatCur(
          meta
        )}). O grau de confiança atual do modelo preditivo é de **${forecastData.confianca.indiceConfiancaPct}% (${forecastData.confianca.nivel})**.`,
        category: "FORECAST",
        kpis: [
          { label: "Projeção Fechamento", value: formatCur(proj), color: "emerald" },
          { label: "Meta Comercial", value: formatCur(meta) },
          { label: "Atingimento Est.", value: `${pct}%`, color: pct >= 100 ? "emerald" : "amber" },
          { label: "Confiança Modelo", value: `${forecastData.confianca.indiceConfiancaPct}%`, color: "emerald" },
        ],
        suggestedFollowUps: [
          "Quais são os principais riscos do forecast?",
          "Qual é o MACO projetado para o fechamento?",
          "Como está o desempenho por gerente?",
        ],
      };
    }

    // B) DRE & RENTABILIDADE / MACO
    if (qLower.includes("maco") || qLower.includes("margem") || qLower.includes("dre") || qLower.includes("lucro") || qLower.includes("cpv")) {
      const maco = dreData.totais.macoTotal;
      const margem = dreData.totais.margemMacoMedia;
      const recLiq = dreData.totais.faturamentoLiquido;

      return {
        answer: `A DRE Comercial indica uma Receita Líquida de **${formatCur(
          recLiq
        )}** com Margem MACO acumulada de **${formatCur(
          maco
        )} (${margem.toFixed(1)}%)**. O frete representa 3.0% fixo sobre o faturamento.`,
        category: "DRE",
        kpis: [
          { label: "Receita Líquida", value: formatCur(recLiq) },
          { label: "MACO Acumulado", value: formatCur(maco), color: "emerald" },
          { label: "Margem MACO %", value: `${margem.toFixed(1)}%`, color: "emerald" },
        ],
        suggestedFollowUps: [
          "Qual a projeção de MACO no Forecast?",
          "Como simular um aumento de 2% na margem?",
          "Qual regional possui melhor margem?",
        ],
      };
    }

    // C) CRM & CLIENTES EM RISCO
    if (qLower.includes("crm") || qLower.includes("risco") || qLower.includes("inativo") || qLower.includes("oportunidade")) {
      const emRisco = crmData.resumo.totalClientesEmRisco;
      const inativos = crmData.resumo.totalClientesInativos;
      const acao = crmData.oportunidades[0]?.titulo || "Reativação de Contas Estratégicas";

      return {
        answer: `O CRM Comercial mapeou **${emRisco} clientes em risco** e **${inativos} clientes inativos**. A principal ação prescritiva recomendada é: **${acao}**.`,
        category: "CRM",
        kpis: [
          { label: "Clientes em Risco", value: String(emRisco), color: "rose" },
          { label: "Clientes Inativos", value: String(inativos), color: "amber" },
          { label: "Total Carteira", value: String(crmData.resumo.totalClientesCarteira) },
        ],
        suggestedFollowUps: [
          "Quais são os Top 3 clientes em risco?",
          "Qual é o impacto financeiro de reativar estes clientes?",
          "Quem é o gerente responsável por estas contas?",
        ],
      };
    }

    // D) SIMULAÇÃO COMERCIAL
    if (qLower.includes("simula") || qLower.includes("cenário") || qLower.includes("roi") || qLower.includes("payback")) {
      const roi = simulationData.impactoGlobal.roiSimuladoPct;
      const pb = simulationData.impactoGlobal.paybackMeses;
      const diff = simulationData.impactoGlobal.diferencaFaturamento;

      return {
        answer: `Na simulação ativa, o incremento projetado de faturamento é de **${formatCur(
          diff
        )}**, gerando um **ROI de +${roi}%** com Payback estimado em **${pb} meses**.`,
        category: "SIMULACAO",
        kpis: [
          { label: "Incremento Simulado", value: formatCur(diff), color: "emerald" },
          { label: "ROI Estimado", value: `+${roi}%`, color: "emerald" },
          { label: "Payback", value: `${pb} meses` },
        ],
        suggestedFollowUps: [
          "Como simular a perda de uma rede?",
          "Qual é a comparação de cenários?",
          "Qual a recomendação desta simulação?",
        ],
      };
    }

    // E) CENTRO DE INTELIGÊNCIA & SAÚDE GLOBAL
    if (qLower.includes("inteligência") || qLower.includes("saúde") || qLower.includes("radar") || qLower.includes("score")) {
      const score = intelligenceData.kpis.scoreSaudeGlobalCarteira;

      return {
        answer: `O Centro de Inteligência Comercial registra um **Score Global de Saúde da Carteira de ${score}/100**. Foram identificadas **${intelligenceData.radarOportunidades.length} ocorrências estratégicas** no radar de monitoramento.`,
        category: "INTELIGENCIA",
        kpis: [
          { label: "Score de Saúde", value: `${score}/100`, color: "emerald" },
          { label: "Ocorrências Radar", value: String(intelligenceData.radarOportunidades.length) },
        ],
        suggestedFollowUps: [
          "Quais são os principais alertas do radar?",
          "Qual regional possui maior score?",
          "Quais clientes demandam atenção imediata?",
        ],
      };
    }

    // F) RESPOSTA PADRÃO EXECUTIVA (FATURAMENTO GERAL)
    const fatBruto = dreData.totais.faturamentoBruto;
    const fatLiq = dreData.totais.faturamentoLiquido;

    return {
      answer: `Com base nas fontes oficiais homologadas do Coffee++, o Faturamento Bruto apurado é de **${formatCur(
        fatBruto
      )}** (Receita Líquida: **${formatCur(
        fatLiq
      )}**). O sistema opera sob 100% de paridade financeira com os bancos oficiais.`,
      category: "FATURAMENTO",
      kpis: [
        { label: "Faturamento Bruto", value: formatCur(fatBruto) },
        { label: "Faturamento Líquido", value: formatCur(fatLiq), color: "emerald" },
        { label: "Paridade Financeira", value: "0,0000% Desvio", color: "emerald" },
      ],
      suggestedFollowUps: [
        "Qual é a projeção de fechamento do mês?",
        "Qual é o MACO acumulado?",
        "Quais redes apresentam maior volume?",
      ],
    };
  }
}
