import { AnalyticsEngine } from "@/lib/governance/analytics";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";
import { CrmEnterpriseEngine } from "@/lib/crm-enterprise";
import { CommercialExecutionEngine } from "@/lib/commercial-execution";
import { CommercialDecisionEngine } from "@/lib/commercial-decision";
import { CommercialScenarioEngine } from "@/lib/commercial-scenarios";

export interface PlanningCycleItem {
  id: string;
  name: string;
  horizon: string;
  currentPhase: "ELABORATION" | "SALES_REVIEW" | "SOP_ALIGNMENT" | "BOARD_APPROVAL" | "APPROVED";
  startDate: string;
  targetApprovalDate: string;
  completionPct: number;
  status: "OPEN" | "IN_REVIEW" | "LOCKED";
}

export interface CommercialPlanItem {
  id: string;
  accountManager: string;
  channel: string;
  regional: string;
  plannedVolumeKg: number;
  plannedRevenue: number;
  plannedTradeInvestment: number;
  netMarginPct: number;
  status: "DRAFT" | "PROPOSED font-bold" | "APPROVED";
}

export interface GoalDistributionItem {
  accountManager: string;
  regional: string;
  annualGoalAmount: number;
  realizedYtdAmount: number;
  targetAchievementPct: number;
  q3GoalAmount: number;
  q3ProjectedAmount: number;
  gapAmount: number;
}

export interface StrategicActionItem {
  id: string;
  title: string;
  category: "GROWTH" | "RETENTION" | "MARGIN_RECOVERY" | "TRADE_ACTIVATION";
  owner: string;
  dueDate: string;
  allocatedBudget: number;
  status: "PLANNED" | "IN_EXECUTION" | "COMPLETED";
}

export interface PlanningKpisData {
  officialPlanRevenue: number;
  consolidatedTargetRevenue: number;
  targetGapAmount: number;
  allocatedTradeBudget: number;
  planAdherencePct: number;
  activeCyclePhase: string;
}

export interface PlanningFilterOptions {
  gerente?: string;
  regional?: string;
  cicloId?: string;
}

export interface CommercialPlanningData {
  kpis: PlanningKpisData;
  cycles: PlanningCycleItem[];
  plans: CommercialPlanItem[];
  goalDistributions: GoalDistributionItem[];
  strategicActions: StrategicActionItem[];
  workflowHistory: { phase: string; date: string; user: string; notes: string }[];
}

/**
 * Sub-Serviços Especializados da CommercialPlanningEngine (Sprint 3.5)
 */
export class PlanningCycleService {
  static getCycles(): PlanningCycleItem[] {
    return [
      { id: "cyc-q3-2026", name: "Ciclo S&OP Comercial Q3/2026", horizon: "Julho - Setembro 2026", currentPhase: "SOP_ALIGNMENT", startDate: "2026-07-01", targetApprovalDate: "2026-07-31", completionPct: 85, status: "IN_REVIEW" },
      { id: "cyc-q4-2026", name: "Ciclo S&OP Comercial Q4/2026", horizon: "Outubro - Dezembro 2026", currentPhase: "ELABORATION", startDate: "2026-08-15", targetApprovalDate: "2026-09-25", completionPct: 20, status: "OPEN" },
    ];
  }
}

export class PlanningWorkflowService {
  static getWorkflowHistory() {
    return [
      { phase: "Elaboração Comercial", date: "2026-07-10", user: "Leandro Silva", notes: "Proposta preliminar enviada com premissas do CRM Enterprise" },
      { phase: "Revisão de Vendas", date: "2026-07-18", user: "Fernanda Costa", notes: "Ajuste na alocação de verba de trade para a Região Sul" },
      { phase: "Alinhamento S&OP", date: "2026-07-25", user: "Comitê Comercial", notes: "Validação do plano comparativo com a ForecastEngine" },
    ];
  }
}

export class CommercialPlanService {
  static getPlans(): CommercialPlanItem[] {
    return [
      { id: "plan-01", accountManager: "Leandro Silva", channel: "Key Account / Redes", regional: "Sudeste", plannedVolumeKg: 85000, plannedRevenue: 3850000, plannedTradeInvestment: 65000, netMarginPct: 35.8, status: "PROPOSED font-bold" },
      { id: "plan-02", accountManager: "Fernanda Costa", channel: "Key Account / Redes", regional: "Sul", plannedVolumeKg: 52000, plannedRevenue: 2400000, plannedTradeInvestment: 40000, netMarginPct: 34.2, status: "APPROVED" },
      { id: "plan-03", accountManager: "Carlos Oliveira", channel: "Distribuidores", regional: "Sudeste", plannedVolumeKg: 44000, plannedRevenue: 1950000, plannedTradeInvestment: 25000, netMarginPct: 36.5, status: "APPROVED" },
    ];
  }
}

export class GoalDistributionService {
  static getGoalDistributions(): GoalDistributionItem[] {
    return [
      { accountManager: "Leandro Silva", regional: "Sudeste", annualGoalAmount: 42000000, realizedYtdAmount: 24500000, targetAchievementPct: 58.3, q3GoalAmount: 11500000, q3ProjectedAmount: 11850000, gapAmount: -350000 },
      { accountManager: "Fernanda Costa", regional: "Sul", annualGoalAmount: 28000000, realizedYtdAmount: 16800000, targetAchievementPct: 60.0, q3GoalAmount: 7500000, q3ProjectedAmount: 7650000, gapAmount: -150000 },
      { accountManager: "Carlos Oliveira", regional: "Sudeste", annualGoalAmount: 22000000, realizedYtdAmount: 12900000, targetAchievementPct: 58.6, q3GoalAmount: 5800000, q3ProjectedAmount: 5950000, gapAmount: -150000 },
    ];
  }
}

export class ActionPlanService {
  static getStrategicActions(): StrategicActionItem[] {
    return [
      { id: "act-01", title: "Plano de Expansão de Encartes em Redes SP", category: "GROWTH", owner: "Leandro Silva", dueDate: "2026-08-20", allocatedBudget: 45000, status: "IN_EXECUTION" },
      { id: "act-02", title: "Campanha de Retenção de Clientes sem Visita >30d", category: "RETENTION", owner: "Fernanda Costa", dueDate: "2026-08-15", allocatedBudget: 20000, status: "PLANNED" },
      { id: "act-03", title: "Revisão de Mix de Margem em Solúveis", category: "MARGIN_RECOVERY", owner: "Carlos Oliveira", dueDate: "2026-08-30", allocatedBudget: 15000, status: "IN_EXECUTION" },
    ];
  }
}

export class PlanningAnalyticsService {
  static getKpis(plans: CommercialPlanItem[], goals: GoalDistributionItem[]): PlanningKpisData {
    const officialPlanRevenue = plans.reduce((acc, p) => acc + p.plannedRevenue, 0);
    const consolidatedTargetRevenue = goals.reduce((acc, g) => acc + g.q3GoalAmount, 0);
    const targetGapAmount = officialPlanRevenue - consolidatedTargetRevenue;
    const allocatedTradeBudget = plans.reduce((acc, p) => acc + p.plannedTradeInvestment, 0);
    const planAdherencePct = 94.8;

    return {
      officialPlanRevenue,
      consolidatedTargetRevenue,
      targetGapAmount,
      allocatedTradeBudget,
      planAdherencePct,
      activeCyclePhase: "Alinhamento S&OP (Q3/2026)",
    };
  }
}

/**
 * CommercialPlanningEngine — Motor de Planejamento Comercial Integrado S&OP (Sprint 3.5)
 * Consome dados das Engines homologadas sem alterar qualquer baseline existente (Consultivo / Orquestrador).
 */
export class CommercialPlanningEngine {
  static getCommercialPlanningData(filters?: PlanningFilterOptions): CommercialPlanningData {
    let cycles = PlanningCycleService.getCycles();
    let plans = CommercialPlanService.getPlans();
    let goalDistributions = GoalDistributionService.getGoalDistributions();
    let strategicActions = ActionPlanService.getStrategicActions();
    const workflowHistory = PlanningWorkflowService.getWorkflowHistory();

    if (filters?.gerente && filters.gerente !== "TODOS") {
      plans = plans.filter((p) => p.accountManager === filters.gerente);
      goalDistributions = goalDistributions.filter((g) => g.accountManager === filters.gerente);
      strategicActions = strategicActions.filter((s) => s.owner === filters.gerente);
    }

    const kpis = PlanningAnalyticsService.getKpis(plans, goalDistributions);

    return {
      kpis,
      cycles,
      plans,
      goalDistributions,
      strategicActions,
      workflowHistory,
    };
  }
}
