import { DecisionScoreDefinition } from "../dto/decision-dto";
import { HealthRules } from "./rules/health-rules";

export class ScoreRegistry {
  private static scoresCatalog: Record<string, DecisionScoreDefinition> = {
    healthScore: {
      scoreKey: "healthScore",
      name: "Health Score",
      formula: "Math.min(100, Math.max(0, Math.round(pacePct)))",
      scale: "0 - 100",
      weightPct: 30,
      classification: "Saudável",
      description: "Mede a saúde financeira e comercial combinando Pace, Meta e Forecast.",
      traceability: ["AnalyticsEngine V1", "mv_vendas_cliente_mensal", "cm_weekly_projections"]
    },
    commercialScore: {
      scoreKey: "commercialScore",
      name: "Commercial Score",
      formula: "Math.round((pacePct * 0.7) + (positivacaoPct * 0.3))",
      scale: "0 - 100",
      weightPct: 25,
      classification: "Bom",
      description: "Mede o desempenho comercial do gerente ou rede de vendas.",
      traceability: ["CommercialPlanningService", "CockpitService"]
    },
    growthScore: {
      scoreKey: "growthScore",
      name: "Growth Score",
      formula: "Math.min(100, Math.max(0, Math.round(pacePct)))",
      scale: "0 - 100",
      weightPct: 15,
      classification: "Acelerado",
      description: "Mede o ritmo de crescimento de faturamento frente ao histórico.",
      traceability: ["AnalyticsEngine V1", "Rolling FAT 3M"]
    },
    opportunityScore: {
      scoreKey: "opportunityScore",
      name: "Opportunity Score",
      formula: "Math.min(100, Math.max(0, Math.round((gap / meta) * 100)))",
      scale: "0 - 100",
      weightPct: 15,
      classification: "Alto Potencial",
      description: "Mede o potencial de alavancagem de vendas não capturadas.",
      traceability: ["CommercialPlanningService", "Gap Meta"]
    },
    priorityScore: {
      scoreKey: "priorityScore",
      name: "Priority Score",
      formula: "Math.round((riskScore * 0.4) + (oppScore * 0.4) + (growthScore * 0.2))",
      scale: "0 - 100",
      weightPct: 10,
      classification: "Alta Prioridade",
      description: "Define a ordem de prioridade executiva para atuação do gerente.",
      traceability: ["PriorityRules", "DecisionPlatform Engine"]
    },
    riskScore: {
      scoreKey: "riskScore",
      name: "Risk Score",
      formula: "Math.min(100, Math.max(0, Math.round(100 - pacePct)))",
      scale: "0 - 100",
      weightPct: 5,
      classification: "Atenção",
      description: "Mede o grau de risco de não atingimento da meta mensal.",
      traceability: ["RiskRules", "DecisionPlatform Engine"]
    },
    forecastConfidence: {
      scoreKey: "forecastConfidence",
      name: "Forecast Confidence",
      formula: "Pace >= 90 ? 98% : 85%",
      scale: "0% - 100%",
      weightPct: 100,
      classification: "Alta Confiança",
      description: "Grau de confiabilidade estocástica do modelo determinístico.",
      traceability: ["ForecastRules", "AnalyticsEngine V1"]
    }
  };

  public static getCatalog(): Record<string, DecisionScoreDefinition> {
    return { ...this.scoresCatalog };
  }

  public static getScoreDefinition(scoreKey: string): DecisionScoreDefinition | undefined {
    return this.scoresCatalog[scoreKey];
  }
}
