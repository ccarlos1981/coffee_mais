import { AnalyticsEngine, CockpitComercialData, DreComercialData, CrmComercialData } from "@/lib/governance/analytics/engine";
import { AnalyticsFilters } from "@/lib/governance/analytics";

export interface IntelligenceOpportunityRadar {
  id: string;
  categoria: "EXPANSAO_ESTRATECICA" | "RISCO_OPERACOES" | "EFICIENCIA_MARGEM" | "POSITIVACAO_CRITICA";
  titulo: string;
  descricao: string;
  entidadeNome: string; // Cliente, Gerente ou Rede
  gerenteNome: string;
  impactoEstimado: number;
  scorePrioridade: number; // 0 a 100
  nivelRisco: "ALTO" | "MEDIO" | "BAIXO";
}

export interface IntelligenceRegionalPerf {
  regiaoOuUf: string;
  totalClientes: number;
  faturamentoBruto: number;
  faturamentoLiquido: number;
  macoTotal: number;
  margemMacoMedia: number;
  scoreEficiencia: number; // 0 a 100
  oportunidadesTotal: number;
}

export interface CommercialIntelligenceData {
  kpis: {
    faturamentoConsolidado: number;
    macoConsolidado: number;
    margemMacoGlobalPct: number;
    scoreSaudeGlobalCarteira: number;
    totalClientesAnalisados: number;
    totalOportunidadesRadar: number;
    potencialImpactoTotal: number;
  };
  radarOportunidades: IntelligenceOpportunityRadar[];
  desempenhoRegional: IntelligenceRegionalPerf[];
  cockpitSummary: {
    crescimentoNominal: number;
    crescimentoPercentual: number;
    clientesAtivos: number;
    clientesEmRisco: number;
  };
}

/**
 * Motor Analítico Independente — Centro de Inteligência Comercial
 * 
 * Agrupa inteligência analítica consolidada do ecossistema comercial Coffee++
 * sem modificar nenhuma linha de código das Fases 1, 2 ou 3 do Sistema Inovações.
 */
export class CommercialIntelligenceEngine {
  static async getCommercialIntelligence(filters: AnalyticsFilters): Promise<CommercialIntelligenceData> {
    // Consumir os métodos analíticos oficiais em paralelo de forma read-only
    const [cockpitData, dreData, crmData] = await Promise.all([
      AnalyticsEngine.getCockpitComercial(filters),
      AnalyticsEngine.getDreComercial(filters),
      AnalyticsEngine.getCrmComercial(filters),
    ]);

    // 1. Apuração dos KPIs Consolidados
    const faturamentoConsolidado = dreData.totais.faturamentoLiquido;
    const macoConsolidado = dreData.totais.macoTotal;
    const margemMacoGlobalPct = dreData.totais.margemMacoMedia;
    const scoreSaudeGlobalCarteira = crmData.resumo.scoreSaudeGlobal;
    const totalClientesAnalisados = crmData.resumo.totalClientesCarteira;

    // 2. Mapeamento do Radar Estratégico de Oportunidades & Riscos
    const radarOportunidades: IntelligenceOpportunityRadar[] = [];

    crmData.oportunidades.forEach((op, idx) => {
      let categoria: IntelligenceOpportunityRadar["categoria"] = "EXPANSAO_ESTRATECICA";
      let nivelRisco: IntelligenceOpportunityRadar["nivelRisco"] = "MEDIO";

      if (op.prioridade === "ALTA") {
        categoria = op.diasSemComprar > 45 ? "RISCO_OPERACOES" : "EFICIENCIA_MARGEM";
        nivelRisco = "ALTO";
      } else if (op.prioridade === "MEDIA") {
        categoria = op.margemMacoAtual < 25 ? "EFICIENCIA_MARGEM" : "POSITIVACAO_CRITICA";
        nivelRisco = "MEDIO";
      } else {
        categoria = "EXPANSAO_ESTRATECICA";
        nivelRisco = "BAIXO";
      }

      radarOportunidades.push({
        id: `radar-${op.id}-${idx}`,
        categoria,
        titulo: op.titulo,
        descricao: op.descricao,
        entidadeNome: op.clienteNome,
        gerenteNome: op.gerenteNome,
        impactoEstimado: op.valorImpactoPotencial,
        scorePrioridade: op.scoreImpacto,
        nivelRisco,
      });
    });

    // Ordenar Radar por Score de Prioridade (Decrescente)
    radarOportunidades.sort((a, b) => b.scorePrioridade - a.scorePrioridade);

    const totalOportunidadesRadar = radarOportunidades.length;
    const potencialImpactoTotal = radarOportunidades.reduce((acc, r) => acc + r.impactoEstimado, 0);

    // 3. Apuração por Desempenho Regional
    const regionalMap = new Map<string, { faturamento: number; cpv: number; impostos: number; maco: number; clientesCount: number; opsCount: number }>();

    dreData.dimensionais.forEach((dim) => {
      const regKey = "Brasil (Consolidado)";
      const curr = regionalMap.get(regKey) || { faturamento: 0, cpv: 0, impostos: 0, maco: 0, clientesCount: 0, opsCount: 0 };
      curr.faturamento += dim.faturamentoLiquido;
      curr.cpv += dim.cpv;
      curr.impostos += dim.impostos;
      curr.maco += dim.maco;
      curr.clientesCount += 1;
      regionalMap.set(regKey, curr);
    });

    // Agrupar por gerentes como proxy regional
    crmData.rankingGerentesScore.forEach((g) => {
      const regKey = `Região Gerencial: ${g.gerente}`;
      const faturamentoEst = (faturamentoConsolidado / (crmData.rankingGerentesScore.length || 1));
      const macoEst = (macoConsolidado / (crmData.rankingGerentesScore.length || 1));

      regionalMap.set(regKey, {
        faturamento: faturamentoEst,
        cpv: faturamentoEst * 0.45,
        impostos: faturamentoEst * 0.15,
        maco: macoEst,
        clientesCount: g.totalClientes,
        opsCount: g.oportunidadesPrioritarias,
      });
    });

    const desempenhoRegional: IntelligenceRegionalPerf[] = Array.from(regionalMap.entries()).map(([reg, val]) => {
      const margemMacoMedia = val.faturamento > 0 ? (val.maco / val.faturamento) * 100 : 0;
      const scoreEficiencia = Math.min(100, Math.round(margemMacoMedia * 1.1 + (val.opsCount === 0 ? 20 : 0)));

      return {
        regiaoOuUf: reg,
        totalClientes: val.clientesCount,
        faturamentoBruto: Number((val.faturamento * 1.18).toFixed(2)),
        faturamentoLiquido: Number(val.faturamento.toFixed(2)),
        macoTotal: Number(val.maco.toFixed(2)),
        margemMacoMedia: Number(margemMacoMedia.toFixed(1)),
        scoreEficiencia,
        oportunidadesTotal: val.opsCount,
      };
    }).sort((a, b) => b.faturamentoLiquido - a.faturamentoLiquido);

    return {
      kpis: {
        faturamentoConsolidado: Number(faturamentoConsolidado.toFixed(2)),
        macoConsolidado: Number(macoConsolidado.toFixed(2)),
        margemMacoGlobalPct: Number(margemMacoGlobalPct.toFixed(1)),
        scoreSaudeGlobalCarteira,
        totalClientesAnalisados,
        totalOportunidadesRadar,
        potencialImpactoTotal: Number(potencialImpactoTotal.toFixed(2)),
      },
      radarOportunidades,
      desempenhoRegional,
      cockpitSummary: {
        crescimentoNominal: cockpitData.metrics.crescimentoNominal,
        crescimentoPercentual: cockpitData.metrics.crescimentoPercentual,
        clientesAtivos: cockpitData.metrics.clientesAtivos,
        clientesEmRisco: cockpitData.metrics.clientesAtencao,
      },
    };
  }
}
