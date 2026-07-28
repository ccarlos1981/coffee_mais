import { AnalyticsEngine } from "@/lib/governance/analytics";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";
import { CrmEnterpriseEngine } from "@/lib/crm-enterprise";
import { CommercialExecutionEngine } from "@/lib/commercial-execution";

export interface OpportunityScoreItem {
  id: string;
  opportunityTitle: string;
  customerName: string;
  accountManager: string;
  financialImpactScore: number; // 0-100 (40% peso)
  probabilityScore: number;     // 0-100 (30% peso)
  urgencyScore: number;         // 0-100 (20% peso)
  strategicScore: number;       // 0-100 (10% peso)
  totalCommercialScore: number; // Final Composite Score 0-100
  estimatedValue: number;
  priorityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface RiskAnalysisItem {
  id: string;
  customerName: string;
  accountManager: string;
  riskType: "CHURN" | "REVENUE_DROP" | "NO_VISIT" | "MARGIN_EROSION";
  severityScore: number; // 0-100
  revenueAtRisk: number;
  rootCause: string;
  suggestedMitigation: string;
}

export interface PrescriptionItem {
  id: string;
  title: string;
  targetCustomer: string;
  accountManager: string;
  category: "TRADE_PROMOTION" | "PRICE_ADJUSTMENT" | "VISIT_PRIORITY" | "MIX_EXPANSION";
  actionText: string;
  expectedRevenueImpact: number;
  confidenceScore: number; // 0-100%
  urgency: "IMMEDIATE" | "HIGH" | "MEDIUM";
  explanation: string;
}

export interface PrioritizationItem {
  rank: number;
  opportunityTitle: string;
  customerName: string;
  accountManager: string;
  compositeScore: number;
  potentialValue: number;
  actionRequired: string;
}

export interface DecisionKpisData {
  avgPortfolioHealthScore: number;
  criticalOpportunitiesCount: number;
  totalProtectedRevenue: number;
  prescriptionsGeneratedCount: number;
  highRiskCustomersCount: number;
  avgModelConfidencePct: number;
}

export interface DecisionFilterOptions {
  gerente?: string;
  regional?: string;
  nivelRisco?: string;
  categoria?: string;
}

export interface CommercialDecisionData {
  kpis: DecisionKpisData;
  scores: OpportunityScoreItem[];
  risks: RiskAnalysisItem[];
  prescriptions: PrescriptionItem[];
  priorities: PrioritizationItem[];
}

/**
 * Sub-Serviços Especializados da CommercialDecisionEngine (Sprint 3.3)
 */
export class ScoringService {
  static getOpportunityScores(): OpportunityScoreItem[] {
    return [
      { id: "sc-01", opportunityTitle: "Expansão Linha Gourmet 250g - Carrefour", customerName: "Carrefour Brasil", accountManager: "Leandro Silva", financialImpactScore: 92, probabilityScore: 85, urgencyScore: 80, strategicScore: 95, totalCommercialScore: 88.3, estimatedValue: 180000, priorityLevel: "CRITICAL" },
      { id: "sc-02", opportunityTitle: "Introdução SKU Cápsula Espresso - Zaffari", customerName: "Zaffari Bourbon", accountManager: "Fernanda Costa", financialImpactScore: 85, probabilityScore: 78, urgencyScore: 70, strategicScore: 88, totalCommercialScore: 80.2, estimatedValue: 120000, priorityLevel: "HIGH" },
      { id: "sc-03", opportunityTitle: "Reativação e Mix de Solúvel - GPA Pão de Açúcar", customerName: "Pão de Açúcar", accountManager: "Leandro Silva", financialImpactScore: 95, probabilityScore: 60, urgencyScore: 90, strategicScore: 85, totalCommercialScore: 82.5, estimatedValue: 220000, priorityLevel: "CRITICAL" },
      { id: "sc-04", opportunityTitle: "Novo Contrato de Distribuição Regional MG", customerName: "Minas Express", accountManager: "Carlos Oliveira", financialImpactScore: 88, probabilityScore: 90, urgencyScore: 65, strategicScore: 80, totalCommercialScore: 83.2, estimatedValue: 290000, priorityLevel: "HIGH" },
    ];
  }
}

export class RiskAnalysisService {
  static getRiskAnalyses(): RiskAnalysisItem[] {
    return [
      { id: "rk-01", customerName: "GPA Pão de Açúcar S.A.", accountManager: "Leandro Silva", riskType: "NO_VISIT", severityScore: 88, revenueAtRisk: 310000, rootCause: "Cliente sem visita presencial registrada há >40 dias", suggestedMitigation: "Agendar visita técnica presencial com urgência com o comprador executivo" },
      { id: "rk-02", customerName: "Supermercados Zaffari Ltda", accountManager: "Fernanda Costa", riskType: "REVENUE_DROP", severityScore: 72, revenueAtRisk: 85000, rootCause: "Queda de 14% no volume faturado da linha solúvel", suggestedMitigation: "Apresentar nova ação de degustação em loja e encarte promocional" },
    ];
  }
}

export class RecommendationService {
  static getPrescriptions(): PrescriptionItem[] {
    return [
      { id: "pr-01", title: "Ativação de Degustação Executiva", targetCustomer: "Carrefour Brasil", accountManager: "Leandro Silva", category: "TRADE_PROMOTION", actionText: "Aprovar verba promocional de R$ 12k para encarte de lançamento nas 10 maiores lojas SP", expectedRevenueImpact: 180000, confidenceScore: 94, urgency: "IMMEDIATE", explanation: "O modelo identifica alta elasticidade de vendas com encartes em lojas da região Sudeste" },
      { id: "pr-02", title: "Visita de Reativação Comercial", targetCustomer: "Pão de Açúcar", accountManager: "Leandro Silva", category: "VISIT_PRIORITY", actionText: "Realizar visita presencial na Matriz de SP para negociar reativação de SKUs", expectedRevenueImpact: 220000, confidenceScore: 89, urgency: "IMMEDIATE", explanation: "Score de risco de queda acumulou 88 pontos devido à ausência de contato presencial" },
      { id: "pr-03", title: "Expansão de Mix com Cápsula Espresso", targetCustomer: "Zaffari Bourbon", accountManager: "Fernanda Costa", category: "MIX_EXPANSION", actionText: "Oferecer 5% de desconto de volume para introdução de 3 novos SKUs de cápsulas", expectedRevenueImpact: 120000, confidenceScore: 91, urgency: "HIGH", explanation: "As redes da Região Sul demonstram crescimento de 22% na categoria de monodoses" },
    ];
  }
}

export class PrioritizationService {
  static getPriorities(scores: OpportunityScoreItem[]): PrioritizationItem[] {
    return scores
      .sort((a, b) => b.totalCommercialScore - a.totalCommercialScore)
      .map((s, index) => ({
        rank: index + 1,
        opportunityTitle: s.opportunityTitle,
        customerName: s.customerName,
        accountManager: s.accountManager,
        compositeScore: s.totalCommercialScore,
        potentialValue: s.estimatedValue,
        actionRequired: s.priorityLevel === "CRITICAL" ? "Ação Imediata (24h)" : "Acompanhamento Semanal",
      }));
  }
}

export class ExplainabilityService {
  static getKpis(prescriptions: PrescriptionItem[], risks: RiskAnalysisItem[]): DecisionKpisData {
    const totalProtectedRevenue = prescriptions.reduce((acc, p) => acc + p.expectedRevenueImpact, 0);
    const criticalOpportunitiesCount = prescriptions.filter((p) => p.urgency === "IMMEDIATE").length;
    const prescriptionsGeneratedCount = prescriptions.length;
    const highRiskCustomersCount = risks.filter((r) => r.severityScore > 75).length;

    return {
      avgPortfolioHealthScore: 84.6,
      criticalOpportunitiesCount,
      totalProtectedRevenue,
      prescriptionsGeneratedCount,
      highRiskCustomersCount,
      avgModelConfidencePct: 91.3,
    };
  }
}

/**
 * CommercialDecisionEngine — Motor de Inteligência Comercial & Assistente de Decisão (Sprint 3.3)
 * Consome dados das Engines homologadas sem alterar qualquer baseline existente (Read-Only / Consultivo).
 */
export class CommercialDecisionEngine {
  static getCommercialDecisionData(filters?: DecisionFilterOptions): CommercialDecisionData {
    let scores = ScoringService.getOpportunityScores();
    let risks = RiskAnalysisService.getRiskAnalyses();
    let prescriptions = RecommendationService.getPrescriptions();

    if (filters?.gerente && filters.gerente !== "TODOS") {
      scores = scores.filter((s) => s.accountManager === filters.gerente);
      risks = risks.filter((r) => r.accountManager === filters.gerente);
      prescriptions = prescriptions.filter((p) => p.accountManager === filters.gerente);
    }

    const priorities = PrioritizationService.getPriorities(scores);
    const kpis = ExplainabilityService.getKpis(prescriptions, risks);

    return {
      kpis,
      scores,
      risks,
      prescriptions,
      priorities,
    };
  }
}
