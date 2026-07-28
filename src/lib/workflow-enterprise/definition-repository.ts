// ==============================================================================
// WORKFLOW DEFINITION REPOSITORY
// Sprint 4.1 — Enterprise Workflow Engine (Phase 2 Workflow Definitions)
// ==============================================================================

import { WorkflowDefinition, WorkflowFilterOptions } from "./types";

/**
 * WorkflowDefinitionRepository
 * 
 * Encapsulates all data access and persistence logic for Workflow Definitions.
 * Decouples the service layer from direct database implementations and provides
 * a clean repository pattern abstraction.
 */
export class WorkflowDefinitionRepository {
  private static inMemoryStore: Map<string, WorkflowDefinition> = new Map();

  static {
    this.seedDefaultStore();
  }

  /**
   * Seed default definitions into the repository
   */
  private static seedDefaultStore(): void {
    const defaultTemplates: WorkflowDefinition[] = [
      {
        id: "def-crm-opt-v1",
        workflowKey: "crm_opportunity_workflow",
        name: "Workflow de Oportunidades CRM",
        description: "Ciclo de vida corporativo de aprovação e avanço de oportunidades no CRM",
        entityType: "CRM_OPPORTUNITY",
        version: 1,
        active: true,
        stateMachine: {
          initialState: "Draft",
          terminalStates: ["Completed", "Cancelled", "Rejected"],
          transitions: [
            { fromState: "Draft", toState: "Under Review", allowedRoles: ["Vendedor", "Gerente Regional", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_single_manager" },
            { fromState: "Under Review", toState: "Approved", allowedRoles: ["Gerente Nacional", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_single_manager" },
            { fromState: "Under Review", toState: "Returned", allowedRoles: ["Gerente Nacional", "Admin"] },
            { fromState: "Under Review", toState: "Rejected", allowedRoles: ["Gerente Nacional", "Admin"] },
            { fromState: "Returned", toState: "Under Review", allowedRoles: ["Vendedor", "Gerente Regional"] },
            { fromState: "Approved", toState: "Executing", allowedRoles: ["Vendedor", "Gerente Regional", "Admin"] },
            { fromState: "Executing", toState: "Completed", allowedRoles: ["Vendedor", "Gerente Regional", "Admin"] },
            { fromState: "Draft", toState: "Cancelled", allowedRoles: ["Vendedor", "Admin"] },
            { fromState: "Under Review", toState: "Cancelled", allowedRoles: ["Admin"] },
          ],
        },
        approvalPolicies: [
          {
            policyKey: "policy_single_manager",
            mode: "SINGLE",
            approverRolesOrUsers: ["Gerente Regional", "Gerente Nacional", "Admin"],
            allowSelfApproval: false,
          },
        ],
        metadata: { category: "Comercial", icon: "Building2" },
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "def-sop-plan-v1",
        workflowKey: "sop_planning_workflow",
        name: "Workflow S&OP Planejamento Integrado",
        description: "Aprovação sequencial de ciclos de planejamento comercial corporativo",
        entityType: "SOP_PLAN",
        version: 1,
        active: true,
        stateMachine: {
          initialState: "Draft",
          terminalStates: ["Completed", "Cancelled", "Rejected"],
          transitions: [
            { fromState: "Draft", toState: "Under Review", allowedRoles: ["Gerente Regional", "Gerente Nacional", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_sequential_directors" },
            { fromState: "Under Review", toState: "Approved", allowedRoles: ["Diretor", "CEO", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_sequential_directors" },
            { fromState: "Under Review", toState: "Returned", allowedRoles: ["Diretor", "CEO", "Admin"] },
            { fromState: "Under Review", toState: "Rejected", allowedRoles: ["Diretor", "CEO", "Admin"] },
            { fromState: "Returned", toState: "Under Review", allowedRoles: ["Gerente Regional", "Gerente Nacional"] },
            { fromState: "Approved", toState: "Executing", allowedRoles: ["Gerente Nacional", "Admin"] },
            { fromState: "Executing", toState: "Completed", allowedRoles: ["Gerente Nacional", "Admin"] },
            { fromState: "Draft", toState: "Cancelled", allowedRoles: ["Admin"] },
          ],
        },
        approvalPolicies: [
          {
            policyKey: "policy_sequential_directors",
            mode: "SEQUENTIAL",
            approverRolesOrUsers: ["Gerente Nacional", "Diretor", "CEO"],
            allowSelfApproval: false,
          },
        ],
        metadata: { category: "Estratégico", icon: "Compass" },
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
      {
        id: "def-invest-action-v1",
        workflowKey: "investment_action_workflow",
        name: "Workflow de Aprovação de Investimentos Trade",
        description: "Aprovação de verba e ações de investimento por quórum comercial",
        entityType: "INVESTMENT_ACTION",
        version: 1,
        active: true,
        stateMachine: {
          initialState: "Draft",
          terminalStates: ["Completed", "Cancelled", "Rejected"],
          transitions: [
            { fromState: "Draft", toState: "Under Review", allowedRoles: ["Trade", "Supervisor", "Gerente Regional", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_trade_quorum" },
            { fromState: "Under Review", toState: "Approved", allowedRoles: ["Trade", "Admin"], requiresApproval: true, approvalPolicyKey: "policy_trade_quorum" },
            { fromState: "Under Review", toState: "Returned", allowedRoles: ["Trade", "Admin"] },
            { fromState: "Under Review", toState: "Rejected", allowedRoles: ["Trade", "Admin"] },
            { fromState: "Returned", toState: "Under Review", allowedRoles: ["Trade", "Supervisor"] },
            { fromState: "Approved", toState: "Executing", allowedRoles: ["Trade", "Admin"] },
            { fromState: "Executing", toState: "Completed", allowedRoles: ["Trade", "Admin"] },
          ],
        },
        approvalPolicies: [
          {
            policyKey: "policy_trade_quorum",
            mode: "QUORUM",
            quorumPercentage: 50,
            approverRolesOrUsers: ["Trade", "Gerente Regional", "Financeiro"],
            allowSelfApproval: false,
          },
        ],
        metadata: { category: "Investimentos", icon: "DollarSign" },
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      },
    ];

    for (const t of defaultTemplates) {
      this.inMemoryStore.set(t.id, t);
    }
  }

  /**
   * Find all definitions matching criteria
   */
  public async findAll(filters?: WorkflowFilterOptions): Promise<WorkflowDefinition[]> {
    let result = Array.from(WorkflowDefinitionRepository.inMemoryStore.values());

    if (!filters) return result;

    if (filters.workflowKey) {
      result = result.filter(d => d.workflowKey === filters.workflowKey);
    }

    if (filters.entityType) {
      result = result.filter(d => d.entityType === filters.entityType);
    }

    if (filters.activeOnly !== false) {
      result = result.filter(d => d.active);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        d =>
          d.name.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.workflowKey.toLowerCase().includes(q) ||
          d.entityType.toLowerCase().includes(q)
      );
    }

    return result;
  }

  /**
   * Find definition by ID
   */
  public async findById(id: string): Promise<WorkflowDefinition | undefined> {
    return WorkflowDefinitionRepository.inMemoryStore.get(id);
  }

  /**
   * Find highest version active definition by key
   */
  public async findByKey(workflowKey: string, version?: number): Promise<WorkflowDefinition | undefined> {
    const matches = Array.from(WorkflowDefinitionRepository.inMemoryStore.values()).filter(
      d => d.workflowKey === workflowKey && d.active
    );

    if (matches.length === 0) return undefined;

    if (version !== undefined) {
      return matches.find(d => d.version === version);
    }

    return matches.reduce((highest, current) => (current.version > highest.version ? current : highest), matches[0]);
  }

  /**
   * Find definition by entityType
   */
  public async findByEntityType(entityType: string): Promise<WorkflowDefinition | undefined> {
    const matches = Array.from(WorkflowDefinitionRepository.inMemoryStore.values()).filter(
      d => d.entityType === entityType && d.active
    );

    if (matches.length === 0) return undefined;

    return matches.reduce((highest, current) => (current.version > highest.version ? current : highest), matches[0]);
  }

  /**
   * Save a new workflow definition
   */
  public async save(definition: WorkflowDefinition): Promise<WorkflowDefinition> {
    WorkflowDefinitionRepository.inMemoryStore.set(definition.id, definition);
    return definition;
  }

  /**
   * Update an existing definition
   */
  public async update(id: string, updates: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const existing = WorkflowDefinitionRepository.inMemoryStore.get(id);
    if (!existing) {
      throw new Error(`WorkflowDefinition não encontrado com ID: ${id}`);
    }

    const updated: WorkflowDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    WorkflowDefinitionRepository.inMemoryStore.set(id, updated);
    return updated;
  }

  /**
   * Soft delete (deactivate) a definition
   */
  public async softDelete(id: string): Promise<WorkflowDefinition> {
    return this.update(id, { active: false });
  }
}
