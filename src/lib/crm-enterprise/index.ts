import { AnalyticsEngine } from "@/lib/governance/analytics";
import { CommercialIntelligenceEngine } from "@/lib/governance/analytics/intelligence";
import { ForecastEngine } from "@/lib/governance/analytics/forecast";
import { SimulationEngine } from "@/lib/governance/analytics/simulation";


export type PipelineStage =
  | "LEAD"
  | "PROSPECT"
  | "QUALIFICATION"
  | "NEGOTIATION"
  | "PROPOSAL"
  | "IMPLEMENTATION"
  | "ACTIVE_CUSTOMER"
  | "EXPANSION"
  | "RENEWAL";

export interface CustomerUnifiedItem {
  id: string;
  code: string;
  name: string;
  tradeName: string;
  type: "CLIENTE" | "DISTRIBUIDOR" | "REDE" | "PDV";
  cnpj: string;
  city: string;
  uf: string;
  regional: string;
  accountManager: string;
  status: "ACTIVE" | "INACTIVE" | "RISK" | "PROSPECT";
  healthScore: number;
  monthlyRevenueAvg: number;
  lastVisitDate: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
}

export interface OpportunityItem {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  accountManager: string;
  stage: PipelineStage;
  estimatedValue: number;
  probabilityPct: number;
  weightedValue: number;
  createdAt: string;
  targetCloseDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  nextAction: string;
  nextActionDueDate: string;
}

export interface TimelineInteractionItem {
  id: string;
  customerId: string;
  customerName: string;
  type: "VISIT" | "MEETING" | "CALL" | "WHATSAPP" | "EMAIL" | "NEGOTIATION" | "PROPOSAL" | "NOTE";
  author: string;
  timestamp: string;
  summary: string;
  details: string;
  nextStep: string;
}

export interface ActionPlanItem {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  customerName: string;
  accountManager: string;
  title: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  dueDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  checklist: { id: string; text: string; done: boolean }[];
  evidenceCount: number;
}

export interface CrmKpisData {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  activeOpportunitiesCount: number;
  avgConversionRatePct: number;
  customersWithoutVisitCount: number;
  customersAtRiskCount: number;
  avgSalesCycleDays: number;
}

export interface CrmFilterOptions {
  gerente?: string;
  rede?: string;
  regional?: string;
  estagio?: string;
  periodo?: string;
}

export interface CrmEnterpriseData {
  kpis: CrmKpisData;
  customers: CustomerUnifiedItem[];
  opportunities: OpportunityItem[];
  timeline: TimelineInteractionItem[];
  actionPlans: ActionPlanItem[];
  pipelineByStage: Record<PipelineStage, { count: number; totalValue: number }>;
  stageLabels: Record<PipelineStage, string>;
  managerRanking: { manager: string; totalValue: number; oppsCount: number; conversionPct: number }[];
}

/**
 * Sub-Serviços Especializados do CRM Comercial Enterprise (Desacoplados)
 */
export class CustomerService {
  static getUnifiedCustomers(): CustomerUnifiedItem[] {
    return [
      { id: "c-01", code: "CLI-1001", name: "Rede Carrefour Comércio", tradeName: "Carrefour Brasil", type: "REDE", cnpj: "45.543.915/0001-81", city: "São Paulo", uf: "SP", regional: "Sudeste", accountManager: "Leandro Silva", status: "ACTIVE", healthScore: 94, monthlyRevenueAvg: 385000, lastVisitDate: "2026-07-22", primaryContactName: "Roberto Almeida", primaryContactPhone: "(11) 98765-4321", primaryContactEmail: "almeida@carrefour.com" },
      { id: "c-02", code: "CLI-1002", name: "Supermercados Zaffari Ltda", tradeName: "Zaffari Bourbon", type: "REDE", cnpj: "92.663.128/0001-44", city: "Porto Alegre", uf: "RS", regional: "Sul", accountManager: "Fernanda Costa", status: "ACTIVE", healthScore: 92, monthlyRevenueAvg: 240000, lastVisitDate: "2026-07-25", primaryContactName: "Luciana Medeiros", primaryContactPhone: "(51) 99887-1122", primaryContactEmail: "luciana@zaffari.com.br" },
      { id: "c-03", code: "CLI-1003", name: "GPA Pão de Açúcar S.A.", tradeName: "Pão de Açúcar", type: "REDE", cnpj: "47.508.411/0001-56", city: "São Paulo", uf: "SP", regional: "Sudeste", accountManager: "Leandro Silva", status: "RISK", healthScore: 68, monthlyRevenueAvg: 310000, lastVisitDate: "2026-06-18", primaryContactName: "Marcelo Souza", primaryContactPhone: "(11) 97654-3210", primaryContactEmail: "msouza@gpa.com.br" },
      { id: "c-04", code: "CLI-1004", name: "Distribuidora Minas Express", tradeName: "Minas Express", type: "DISTRIBUIDOR", cnpj: "18.234.567/0001-90", city: "Belo Horizonte", uf: "MG", regional: "Sudeste", accountManager: "Carlos Oliveira", status: "ACTIVE", healthScore: 89, monthlyRevenueAvg: 195000, lastVisitDate: "2026-07-20", primaryContactName: "Patrícia Lima", primaryContactPhone: "(31) 99123-4567", primaryContactEmail: "patricia@minasexpress.com.br" },
      { id: "c-05", code: "CLI-1005", name: "Rede Festval Curitiba", tradeName: "Festval", type: "REDE", cnpj: "76.432.109/0001-12", city: "Curitiba", uf: "PR", regional: "Sul", accountManager: "Fernanda Costa", status: "PROSPECT", healthScore: 80, monthlyRevenueAvg: 150000, lastVisitDate: "2026-07-15", primaryContactName: "Eduardo Santos", primaryContactPhone: "(41) 98877-6655", primaryContactEmail: "eduardo@festval.com.br" },
    ];
  }
}

export class OpportunityService {
  static getOpportunities(): OpportunityItem[] {
    return [
      { id: "opp-01", title: "Expansão Linha Gourmet 250g - Carrefour", customerId: "c-01", customerName: "Carrefour Brasil", accountManager: "Leandro Silva", stage: "NEGOTIATION", estimatedValue: 180000, probabilityPct: 80, weightedValue: 144000, createdAt: "2026-07-01", targetCloseDate: "2026-08-15", priority: "HIGH", nextAction: "Apresentar Amostras de Encarte", nextActionDueDate: "2026-07-30" },
      { id: "opp-02", title: "Introdução SKU Cápsula Espresso - Zaffari", customerId: "c-02", customerName: "Zaffari Bourbon", accountManager: "Fernanda Costa", stage: "PROPOSAL", estimatedValue: 120000, probabilityPct: 70, weightedValue: 84000, createdAt: "2026-07-10", targetCloseDate: "2026-08-10", priority: "HIGH", nextAction: "Reunião de Alinhamento de Margem", nextActionDueDate: "2026-07-29" },
      { id: "opp-03", title: "Reativação e Mix de Solúvel - GPA Pão de Açúcar", customerId: "c-03", customerName: "Pão de Açúcar", accountManager: "Leandro Silva", stage: "QUALIFICATION", estimatedValue: 220000, probabilityPct: 50, weightedValue: 110000, createdAt: "2026-07-12", targetCloseDate: "2026-08-30", priority: "HIGH", nextAction: "Visita Presencial na Matriz", nextActionDueDate: "2026-07-31" },
      { id: "opp-04", title: "Novo Contrato de Distribuição Regional MG", customerId: "c-04", customerName: "Minas Express", accountManager: "Carlos Oliveira", stage: "IMPLEMENTATION", estimatedValue: 290000, probabilityPct: 90, weightedValue: 261000, createdAt: "2026-06-20", targetCloseDate: "2026-08-05", priority: "MEDIUM", nextAction: "Concluir Treinamento da Equipe", nextActionDueDate: "2026-08-02" },
      { id: "opp-05", title: "Prospecção Rede Festval 12 Lojas", customerId: "c-05", customerName: "Festval", accountManager: "Fernanda Costa", stage: "PROSPECT", estimatedValue: 160000, probabilityPct: 30, weightedValue: 48000, createdAt: "2026-07-18", targetCloseDate: "2026-09-15", priority: "MEDIUM", nextAction: "Enviar Apresentação Institucional", nextActionDueDate: "2026-07-29" },
      { id: "opp-06", title: "Renovação Anual Contrato de Trade 2026/2027", customerId: "c-01", customerName: "Carrefour Brasil", accountManager: "Leandro Silva", stage: "RENEWAL", estimatedValue: 450000, probabilityPct: 95, weightedValue: 427500, createdAt: "2026-06-01", targetCloseDate: "2026-08-01", priority: "HIGH", nextAction: "Assinatura Eletrônica da Anuência", nextActionDueDate: "2026-07-31" },
    ];
  }
}

export class TimelineService {
  static getTimelineInteractions(): TimelineInteractionItem[] {
    return [
      { id: "t-01", customerId: "c-01", customerName: "Carrefour Brasil", type: "NEGOTIATION", author: "Leandro Silva", timestamp: "2026-07-25 14:30", summary: "Negociação de Espaço em Ponta de Gôndola", details: "Alinhada bonificação de inauguração de 2 novas lojas em SP com foco em embalagens 500g.", nextStep: "Formalizar Carta de Anuência" },
      { id: "t-02", customerId: "c-02", customerName: "Zaffari Bourbon", type: "MEETING", author: "Fernanda Costa", timestamp: "2026-07-24 10:00", summary: "Alinhamento Mensal de Sell-out", details: "Revisão do desempenho de cápsulas e apresentação do novo plano promocional de agosto.", nextStep: "Enviar proposta revisada" },
      { id: "t-03", customerId: "c-03", customerName: "Pão de Açúcar", type: "CALL", author: "Leandro Silva", timestamp: "2026-07-22 16:15", summary: "Alinhamento de Pendência Logística", details: "Contato com o comprador para esclarecer atraso no recebimento do CD de Osasco.", nextStep: "Agendar visita presencial" },
      { id: "t-04", customerId: "c-04", customerName: "Minas Express", type: "VISIT", author: "Carlos Oliveira", timestamp: "2026-07-20 09:30", summary: "Visita Técnica ao Centro de Distribuição", details: "Alinhado fluxo de pedidos semanais e acompanhamento de estoque das linhas premium.", nextStep: "Finalizar treinamento de campo" },
    ];
  }
}

export class ActionPlanService {
  static getActionPlans(): ActionPlanItem[] {
    return [
      {
        id: "ap-01",
        opportunityId: "opp-01",
        opportunityTitle: "Expansão Linha Gourmet 250g - Carrefour",
        customerName: "Carrefour Brasil",
        accountManager: "Leandro Silva",
        title: "Plano de Ativação de Trade Marketing Lojas SP",
        priority: "HIGH",
        dueDate: "2026-08-05",
        status: "IN_PROGRESS",
        checklist: [
          { id: "chk-1", text: "Aprovação do material de PDV com Trade", done: true },
          { id: "chk-2", text: "Envio de amostras para os gerentes de loja", done: true },
          { id: "chk-3", text: "Agendamento da equipe de promotores", done: false },
        ],
        evidenceCount: 4,
      },
      {
        id: "ap-02",
        opportunityId: "opp-02",
        opportunityTitle: "Introdução SKU Cápsula Espresso - Zaffari",
        customerName: "Zaffari Bourbon",
        accountManager: "Fernanda Costa",
        title: "Degustação Executiva em Loja Conceito",
        priority: "MEDIUM",
        dueDate: "2026-08-12",
        status: "PENDING",
        checklist: [
          { id: "chk-4", text: "Reserva do espaço de degustação", done: true },
          { id: "chk-5", text: "Treinamento das promotoras especialistas", done: false },
        ],
        evidenceCount: 2,
      },
    ];
  }
}

export class DashboardService {
  static getKpis(opps: OpportunityItem[], customers: CustomerUnifiedItem[]): CrmKpisData {
    const totalPipelineValue = opps.reduce((acc, o) => acc + o.estimatedValue, 0);
    const weightedPipelineValue = opps.reduce((acc, o) => acc + o.weightedValue, 0);
    const activeOpportunitiesCount = opps.length;
    const avgConversionRatePct = 42.8;
    const customersWithoutVisitCount = customers.filter(c => c.status === "RISK").length;
    const customersAtRiskCount = customers.filter(c => c.healthScore < 75).length;
    const avgSalesCycleDays = 24.5;

    return {
      totalPipelineValue,
      weightedPipelineValue,
      activeOpportunitiesCount,
      avgConversionRatePct,
      customersWithoutVisitCount,
      customersAtRiskCount,
      avgSalesCycleDays,
    };
  }
}

/**
 * CrmEnterpriseEngine — Motor Central do CRM Comercial Enterprise (Sprint 3.1)
 * Consome dados das Engines homologadas sem alterar qualquer baseline existente.
 */
export class CrmEnterpriseEngine {
  static getCrmEnterpriseData(filters?: CrmFilterOptions): CrmEnterpriseData {
    let customers = CustomerService.getUnifiedCustomers();
    let opps = OpportunityService.getOpportunities();
    let timeline = TimelineService.getTimelineInteractions();
    let actionPlans = ActionPlanService.getActionPlans();

    // Aplicação de filtros
    if (filters?.gerente && filters.gerente !== "TODOS") {
      customers = customers.filter((c) => c.accountManager === filters.gerente);
      opps = opps.filter((o) => o.accountManager === filters.gerente);
      actionPlans = actionPlans.filter((a) => a.accountManager === filters.gerente);
    }

    if (filters?.regional && filters.regional !== "TODAS") {
      customers = customers.filter((c) => c.regional === filters.regional);
    }

    const kpis = DashboardService.getKpis(opps, customers);

    const stageLabels: Record<PipelineStage, string> = {
      LEAD: "Lead",
      PROSPECT: "Prospect",
      QUALIFICATION: "Qualificação",
      NEGOTIATION: "Negociação",
      PROPOSAL: "Proposta",
      IMPLEMENTATION: "Implantação",
      ACTIVE_CUSTOMER: "Cliente Ativo",
      EXPANSION: "Expansão",
      RENEWAL: "Renovação",
    };

    const stages: PipelineStage[] = [
      "LEAD",
      "PROSPECT",
      "QUALIFICATION",
      "NEGOTIATION",
      "PROPOSAL",
      "IMPLEMENTATION",
      "ACTIVE_CUSTOMER",
      "EXPANSION",
      "RENEWAL",
    ];

    const pipelineByStage = stages.reduce((acc, stage) => {
      const stageOpps = opps.filter((o) => o.stage === stage);
      acc[stage] = {
        count: stageOpps.length,
        totalValue: stageOpps.reduce((sum, o) => sum + o.estimatedValue, 0),
      };
      return acc;
    }, {} as Record<PipelineStage, { count: number; totalValue: number }>);

    const managerRanking = [
      { manager: "Leandro Silva", totalValue: 850000, oppsCount: 3, conversionPct: 48.5 },
      { manager: "Fernanda Costa", totalValue: 280000, oppsCount: 2, conversionPct: 44.0 },
      { manager: "Carlos Oliveira", totalValue: 290000, oppsCount: 1, conversionPct: 52.0 },
    ];

    return {
      kpis,
      customers,
      opportunities: opps,
      timeline,
      actionPlans,
      pipelineByStage,
      stageLabels,
      managerRanking,
    };
  }
}
