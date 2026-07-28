// ==============================================================================
// CRM WORKFLOW INTEGRATION BRIDGE
// Sprint 4.2 — Pilot Integration (CRM Enterprise + Enterprise Workflow Engine)
// ==============================================================================

import { CrmEnterpriseData, OpportunityItem } from "./index";
import { EnterpriseWorkflowEngine, WorkflowInstance } from "@/lib/workflow-enterprise";

export interface CrmOportunidadeWorkflowAnnotation {
  workflowId: string | null;
  workflowState: string; // e.g. "NOT_CREATED", "Draft", "Under Review", "Approved", etc.
  canCreateWorkflow: boolean;
  pendingApprovalsCount: number;
  workflowInstance?: WorkflowInstance;
}

export interface EnrichedOpportunityItem extends OpportunityItem {
  workflow: CrmOportunidadeWorkflowAnnotation;
}

export interface EnrichedCrmEnterpriseData extends Omit<CrmEnterpriseData, "opportunities"> {
  opportunities: EnrichedOpportunityItem[];
}

export class CrmWorkflowBridge {
  private static ENTITY_TYPE = "CRM_OPPORTUNITY";

  /**
   * Idempotent Read Enrichment: Annotates CRM opportunities with existing Workflow instances.
   * STRICTLY READ-ONLY: Never instantiates workflows during GET queries.
   */
  public static enrichCrmDataWithWorkflows(data: CrmEnterpriseData): EnrichedCrmEnterpriseData {
    const oppIds = data.opportunities.map((o: OpportunityItem) => o.id);

    // Batch query via specialized Query API (EnterpriseWorkflowEngine.findByEntities)
    const activeWorkflowsMap = EnterpriseWorkflowEngine.findByEntities(this.ENTITY_TYPE, oppIds);

    const enrichedOportunidades: EnrichedOpportunityItem[] = data.opportunities.map((opp: OpportunityItem) => {
      const existingWorkflow = activeWorkflowsMap[opp.id];

      if (!existingWorkflow) {
        return {
          ...opp,
          workflow: {
            workflowId: null,
            workflowState: "NOT_CREATED",
            canCreateWorkflow: true,
            pendingApprovalsCount: 0,
          },
        };
      }

      const pendingCount = existingWorkflow.approvals.filter(a => a.status === "PENDING").length;

      return {
        ...opp,
        workflow: {
          workflowId: existingWorkflow.workflowId,
          workflowState: existingWorkflow.currentState,
          canCreateWorkflow: false,
          pendingApprovalsCount: pendingCount,
          workflowInstance: existingWorkflow,
        },
      };
    });

    return {
      ...data,
      opportunities: enrichedOportunidades,
    };
  }

  /**
   * Explicit Action: Instantiates a WorkflowInstance for a specific CRM opportunity.
   * EXCLUSIVELY invoked via explicit user interaction (e.g. clicking "Iniciar Workflow").
   */
  public static createWorkflowForOpportunity(
    opportunity: OpportunityItem,
    createdBy: string
  ): WorkflowInstance {
    const existing = EnterpriseWorkflowEngine.findByEntity(this.ENTITY_TYPE, opportunity.id);
    if (existing) {
      return existing;
    }

    return EnterpriseWorkflowEngine.createInstance({
      workflowKey: "crm_opportunity_workflow",
      entityType: this.ENTITY_TYPE,
      entityId: opportunity.id,
      title: `CRM: ${opportunity.title} — R$ ${opportunity.estimatedValue.toLocaleString("pt-BR")}`,
      createdBy,
      assignedTo: opportunity.accountManager,
      priority: opportunity.priority === "HIGH" ? "HIGH" : "MEDIUM",
      metadata: {
        customerName: opportunity.customerName,
        stage: opportunity.stage,
        probabilityPct: opportunity.probabilityPct,
      },
    });
  }
}
