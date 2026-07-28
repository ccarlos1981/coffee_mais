import { AnalyticsEngine } from "@/lib/governance/analytics";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { CrmEnterpriseEngine } from "@/lib/crm-enterprise";

export interface AgendaEventItem {
  id: string;
  time: string;
  type: "VISIT" | "MEETING" | "FOLLOWUP" | "CALL";
  title: string;
  customerName: string;
  address: string;
  accountManager: string;
  status: "SCHEDULED" | "COMPLETED" | "IN_PROGRESS" | "CANCELLED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  objective: string;
}

export interface VisitPlanItem {
  id: string;
  customerId: string;
  customerName: string;
  accountManager: string;
  suggestedDate: string;
  priorityScore: number;
  reason: string;
  recommendedProducts: string[];
  status: "PLANNED" | "CONFIRMED" | "POSTPONED";
}

export interface FollowUpItem {
  id: string;
  customerName: string;
  opportunityTitle: string;
  accountManager: string;
  title: string;
  dueDate: string;
  daysPending: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "PENDING" | "OVERDUE" | "DONE";
}

export interface TaskItem {
  id: string;
  title: string;
  category: "TRADE" | "NEGOTIATION" | "LOGISTICS" | "CADASTRO";
  assignedTo: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
}

export interface ExecutionKpisData {
  scheduledVisitsCount: number;
  completedVisitsCount: number;
  agendaAdherencePct: number;
  pendingFollowUpsCount: number;
  overdueTasksCount: number;
  avgTimeInVisitMinutes: number;
}

export interface ExecutionFilterOptions {
  gerente?: string;
  regional?: string;
  data?: string;
  status?: string;
}

export interface CommercialExecutionData {
  kpis: ExecutionKpisData;
  agenda: AgendaEventItem[];
  visitPlans: VisitPlanItem[];
  followUps: FollowUpItem[];
  tasks: TaskItem[];
  executionAnalytics: {
    managerExecutionRatePct: number;
    weeklyVisitsGoalCount: number;
    weeklyVisitsRealizedCount: number;
    topRegionsExecuted: string[];
  };
}

/**
 * Sub-Serviços da Execução Comercial & Agenda Inteligente (Sprint 3.2)
 */
export class PlanningService {
  static getVisitPlans(): VisitPlanItem[] {
    return [
      { id: "vp-01", customerId: "c-03", customerName: "GPA Pão de Açúcar S.A.", accountManager: "Leandro Silva", suggestedDate: "2026-07-29", priorityScore: 95, reason: "Cliente sem visita há >40 dias com queda de positivação", recommendedProducts: ["Linha Gourmet 250g", "Cápsulas Rituais"], status: "CONFIRMED" },
      { id: "vp-02", customerId: "c-05", customerName: "Rede Festval Curitiba", accountManager: "Fernanda Costa", suggestedDate: "2026-07-30", priorityScore: 88, reason: "Apresentação de Proposta da Prospecção", recommendedProducts: ["Café Torrado 500g", "Drip Coffee"], status: "PLANNED" },
      { id: "vp-03", customerId: "c-04", customerName: "Distribuidora Minas Express", accountManager: "Carlos Oliveira", suggestedDate: "2026-07-31", priorityScore: 82, reason: "Revisão do Estoque de Segurança CD BH", recommendedProducts: ["Linha Solúveis 100g"], status: "PLANNED" },
    ];
  }
}

export class AgendaService {
  static getDailyEvents(): AgendaEventItem[] {
    return [
      { id: "ev-01", time: "09:00", type: "VISIT", title: "Reunião de Alinhamento na Matriz Carrefour", customerName: "Carrefour Brasil", address: "Av. Rebouças, 1500 - SP", accountManager: "Leandro Silva", status: "COMPLETED", priority: "HIGH", objective: "Assinatura do Encarte de Agosto" },
      { id: "ev-02", time: "11:30", type: "CALL", title: "Alinhamento Telefônico Comprador Zaffari", customerName: "Zaffari Bourbon", address: "Remoto / Telefônico", accountManager: "Fernanda Costa", status: "COMPLETED", priority: "MEDIUM", objective: "Confirmar Pedido de Solúveis" },
      { id: "ev-03", time: "14:00", type: "VISIT", title: "Visita Técnica ao CD GPA Osasco", customerName: "Pão de Açúcar", address: "Rod. Anhanguera, Km 18 - SP", accountManager: "Leandro Silva", status: "IN_PROGRESS", priority: "HIGH", objective: "Resolver Inconsistência de Recebimento" },
      { id: "ev-04", time: "16:30", type: "FOLLOWUP", title: "Follow-up da Proposta Festval", customerName: "Festval", address: "Remoto / WhatsApp", accountManager: "Fernanda Costa", status: "SCHEDULED", priority: "MEDIUM", objective: "Validar Prazos de Entrega do Primeiro Lote" },
    ];
  }
}

export class ExecutionService {
  static getKpis(events: AgendaEventItem[], followups: FollowUpItem[]): ExecutionKpisData {
    const scheduledVisitsCount = events.length;
    const completedVisitsCount = events.filter((e) => e.status === "COMPLETED").length;
    const agendaAdherencePct = Math.round((completedVisitsCount / (scheduledVisitsCount || 1)) * 100);
    const pendingFollowUpsCount = followups.filter((f) => f.status === "PENDING").length;
    const overdueTasksCount = followups.filter((f) => f.status === "OVERDUE").length;
    const avgTimeInVisitMinutes = 48;

    return {
      scheduledVisitsCount,
      completedVisitsCount,
      agendaAdherencePct,
      pendingFollowUpsCount,
      overdueTasksCount,
      avgTimeInVisitMinutes,
    };
  }
}

export class FollowUpService {
  static getFollowUps(): FollowUpItem[] {
    return [
      { id: "fu-01", customerName: "Carrefour Brasil", opportunityTitle: "Expansão Linha Gourmet 250g", accountManager: "Leandro Silva", title: "Confirmar aprovação do layout de encarte com Trade", dueDate: "2026-07-28", daysPending: 0, priority: "HIGH", status: "PENDING" },
      { id: "fu-02", customerName: "Pão de Açúcar", opportunityTitle: "Reativação e Mix de Solúvel", accountManager: "Leandro Silva", title: "Revisar relatório de divergência de devoluções", dueDate: "2026-07-27", daysPending: 1, priority: "HIGH", status: "OVERDUE" },
      { id: "fu-03", customerName: "Zaffari Bourbon", opportunityTitle: "Introdução SKU Cápsula Espresso", accountManager: "Fernanda Costa", title: "Enviar tabela de preços atualizada com descontos de volume", dueDate: "2026-07-29", daysPending: 0, priority: "MEDIUM", status: "PENDING" },
    ];
  }
}

export class AnalyticsService {
  static getTasks(): TaskItem[] {
    return [
      { id: "tsk-01", title: "Cadastrar novos SKUs no sistema da Rede Carrefour", category: "CADASTRO", assignedTo: "Leandro Silva", dueDate: "2026-07-30", status: "IN_PROGRESS" },
      { id: "tsk-02", title: "Solicitar envio de 50 amostras para Convenção Zaffari", category: "TRADE", assignedTo: "Fernanda Costa", dueDate: "2026-08-01", status: "OPEN" },
      { id: "tsk-03", title: "Ajustar prazo de pagamento para Distribuidor Minas Express", category: "NEGOTIATION", assignedTo: "Carlos Oliveira", dueDate: "2026-07-29", status: "IN_PROGRESS" },
    ];
  }
}

/**
 * CommercialExecutionEngine — Motor de Execução Comercial & Agenda Inteligente (Sprint 3.2)
 * Consome dados das Engines homologadas sem alterar qualquer baseline existente.
 */
export class CommercialExecutionEngine {
  static getCommercialExecutionData(filters?: ExecutionFilterOptions): CommercialExecutionData {
    let agenda = AgendaService.getDailyEvents();
    let visitPlans = PlanningService.getVisitPlans();
    let followUps = FollowUpService.getFollowUps();
    let tasks = AnalyticsService.getTasks();

    if (filters?.gerente && filters.gerente !== "TODOS") {
      agenda = agenda.filter((a) => a.accountManager === filters.gerente);
      visitPlans = visitPlans.filter((v) => v.accountManager === filters.gerente);
      followUps = followUps.filter((f) => f.accountManager === filters.gerente);
      tasks = tasks.filter((t) => t.assignedTo === filters.gerente);
    }

    const kpis = ExecutionService.getKpis(agenda, followUps);

    return {
      kpis,
      agenda,
      visitPlans,
      followUps,
      tasks,
      executionAnalytics: {
        managerExecutionRatePct: 92.5,
        weeklyVisitsGoalCount: 45,
        weeklyVisitsRealizedCount: 42,
        topRegionsExecuted: ["São Paulo - SP", "Porto Alegre - RS", "Belo Horizonte - MG"],
      },
    };
  }
}
