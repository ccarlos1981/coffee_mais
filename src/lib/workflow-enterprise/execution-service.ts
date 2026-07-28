// ==============================================================================
// WORKFLOW EXECUTION SERVICE
// Sprint 4.2 — Enterprise Workflow Engine (Query API Optimization)
// ==============================================================================

import { ApprovalService } from "./approval-service";
import { WorkflowAuditService } from "./audit-service";
import { WorkflowDefinitionService } from "./definition-service";
import { WorkflowLockService } from "./lock-service";
import { NotificationService } from "./notification-service";
import { WorkflowStateMachineService } from "./state-machine-service";
import {
  AuditTrailEntry,
  WorkflowDefinition,
  WorkflowDomainEventV1,
  WorkflowFilterOptions,
  WorkflowHistoryItem,
  WorkflowInstance,
  WorkflowPriority,
} from "./types";

export interface CreateWorkflowInstanceParams {
  definitionId?: string;
  workflowKey?: string;
  entityType: string;
  entityId: string;
  title: string;
  createdBy: string;
  assignedTo?: string;
  priority?: WorkflowPriority;
  dueDate?: string;
  metadata?: Record<string, any>;
}

export interface TransitionParams {
  workflowId: string;
  targetState: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  comment?: string;
  expectedUpdatedAt?: string;
}

export interface ProcessApprovalExecutionParams {
  workflowId: string;
  stepId?: string;
  approverUserOrRole: string;
  approverName: string;
  approverRole: string;
  action: 'APPROVE' | 'REJECT' | 'RETURN';
  comment?: string;
  expectedUpdatedAt?: string;
}

export class WorkflowExecutionService {
  private static instances: Map<string, WorkflowInstance> = new Map();

  static {
    this.seedDefaultInstances();
  }

  /**
   * Seed initial demonstration workflow instances
   */
  private static seedDefaultInstances(): void {
    const defaultInstances: WorkflowInstance[] = [
      {
        workflowId: "wf-inst-001",
        definitionId: "def-crm-opt-v1",
        workflowKey: "crm_opportunity_workflow",
        entityType: "CRM_OPPORTUNITY",
        entityId: "opt-101",
        title: "Expansão Grupo Carrefour — R$ 250.000,00",
        currentState: "Under Review",
        nextAvailableStates: ["Approved", "Returned", "Rejected", "Cancelled"],
        createdBy: "julliano.silva@coffeemais.com.br",
        assignedTo: "leandro.gerente@coffeemais.com.br",
        priority: "HIGH",
        dueDate: "2026-08-05T18:00:00.000Z",
        approvalPolicy: {
          policyKey: "policy_single_manager",
          mode: "SINGLE",
          approverRolesOrUsers: ["Gerente Regional", "Gerente Nacional", "Admin"],
        },
        approvals: [
          {
            stepId: "step-1",
            stepName: "Aprovação Gerente Comercial",
            approverRoleOrUser: "Gerente Regional",
            status: "PENDING",
          },
        ],
        history: [
          { id: "h-1", action: "Criado", actor: "julliano.silva@coffeemais.com.br", details: "Instância de Workflow criada", timestamp: "2026-07-28T09:00:00.000Z" },
          { id: "h-2", action: "Transição de Estado", actor: "julliano.silva@coffeemais.com.br", details: "Submetido de Draft para Under Review", timestamp: "2026-07-28T10:15:00.000Z" },
        ],
        auditTrail: [
          { id: "aud-1", userId: "usr-1", userName: "Julliano Silva", userRole: "Vendedor", action: "SUBMIT_FOR_REVIEW", fromState: "Draft", toState: "Under Review", comment: "Proposta revisada anexada", timestamp: "2026-07-28T10:15:00.000Z" },
        ],
        eventsLog: [
          {
            eventId: "evt-001",
            eventVersion: "v1",
            eventType: "WorkflowCreated",
            occurredAt: "2026-07-28T09:00:00.000Z",
            workflowId: "wf-inst-001",
            workflowDefinitionId: "def-crm-opt-v1",
            entityType: "CRM_OPPORTUNITY",
            entityId: "opt-101",
            payload: { title: "Expansão Grupo Carrefour" },
            metadata: { category: "Comercial" },
          },
        ],
        createdAt: "2026-07-28T09:00:00.000Z",
        updatedAt: "2026-07-28T10:15:00.000Z",
      },
      {
        workflowId: "wf-inst-002",
        definitionId: "def-sop-plan-v1",
        workflowKey: "sop_planning_workflow",
        entityType: "SOP_PLAN",
        entityId: "sop-2026-08",
        title: "Plano Comercial Integrado S&OP — Agosto/2026",
        currentState: "Executing",
        nextAvailableStates: ["Completed"],
        createdBy: "rodrigo.diretor@coffeemais.com.br",
        assignedTo: "gerente.nacional@coffeemais.com.br",
        priority: "URGENT",
        dueDate: "2026-08-01T12:00:00.000Z",
        approvalPolicy: {
          policyKey: "policy_sequential_directors",
          mode: "SEQUENTIAL",
          approverRolesOrUsers: ["Gerente Nacional", "Diretor", "CEO"],
        },
        approvals: [
          { stepId: "step-1", stepName: "Aprovação Gerência Nacional", approverRoleOrUser: "Gerente Nacional", status: "APPROVED", actionBy: "gerente.nacional@coffeemais.com.br", updatedAt: "2026-07-28T11:00:00.000Z" },
          { stepId: "step-2", stepName: "Aprovação Diretoria", approverRoleOrUser: "Diretor", status: "APPROVED", actionBy: "rodrigo.diretor@coffeemais.com.br", updatedAt: "2026-07-28T11:30:00.000Z" },
        ],
        history: [
          { id: "h-101", action: "Criado", actor: "rodrigo.diretor@coffeemais.com.br", details: "Plano S&OP criado", timestamp: "2026-07-27T14:00:00.000Z" },
          { id: "h-102", action: "Aprovado", actor: "rodrigo.diretor@coffeemais.com.br", details: "Plano aprovado e colocado em execução", timestamp: "2026-07-28T11:30:00.000Z" },
        ],
        auditTrail: [
          { id: "aud-101", userId: "usr-10", userName: "Rodrigo Diretor", userRole: "Diretor", action: "APPROVE_PLAN", fromState: "Approved", toState: "Executing", comment: "Metas validadas com diretoria", timestamp: "2026-07-28T11:30:00.000Z" },
        ],
        eventsLog: [
          {
            eventId: "evt-002",
            eventVersion: "v1",
            eventType: "WorkflowApproved",
            occurredAt: "2026-07-28T11:30:00.000Z",
            workflowId: "wf-inst-002",
            workflowDefinitionId: "def-sop-plan-v1",
            entityType: "SOP_PLAN",
            entityId: "sop-2026-08",
            payload: { title: "Plano Comercial Integrado S&OP" },
            metadata: { category: "Estratégico" },
          },
        ],
        createdAt: "2026-07-27T14:00:00.000Z",
        updatedAt: "2026-07-28T11:30:00.000Z",
      },
    ];

    for (const inst of defaultInstances) {
      this.instances.set(inst.workflowId, inst);
    }
  }

  /**
   * Specialized Query API: Find workflow instance by entityType and entityId
   */
  public static findByEntity(entityType: string, entityId: string): WorkflowInstance | undefined {
    return Array.from(this.instances.values()).find(
      i => i.entityType === entityType && i.entityId === entityId
    );
  }

  /**
   * Specialized Batch Query API: Find workflow instances by entityType and array of entityIds
   */
  public static findByEntities(entityType: string, entityIds: string[]): Record<string, WorkflowInstance> {
    const idSet = new Set(entityIds);
    const result: Record<string, WorkflowInstance> = {};

    for (const inst of this.instances.values()) {
      if (inst.entityType === entityType && idSet.has(inst.entityId)) {
        result[inst.entityId] = inst;
      }
    }

    return result;
  }

  /**
   * Instantiate a new WorkflowInstance bound to a WorkflowDefinition
   */
  public static createInstance(params: CreateWorkflowInstanceParams): WorkflowInstance {
    const definition: WorkflowDefinition | undefined = params.definitionId
      ? WorkflowDefinitionService.getDefinitionByIdSync(params.definitionId)
      : params.workflowKey
      ? WorkflowDefinitionService.getDefinitionByKeySync(params.workflowKey)
      : WorkflowDefinitionService.listDefinitionsSync({ entityType: params.entityType })[0];

    if (!definition) {
      throw new Error(`Nenhuma WorkflowDefinition ativa encontrada para entityType '${params.entityType}'.`);
    }

    const now = new Date().toISOString();
    const workflowId = `wf-inst-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const initialState = definition.stateMachine.initialState;
    const nextStates = WorkflowStateMachineService.getNextAvailableStates(definition, initialState);

    const instance: WorkflowInstance = {
      workflowId,
      definitionId: definition.id,
      workflowKey: definition.workflowKey,
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.title,
      currentState: initialState,
      nextAvailableStates: nextStates,
      createdBy: params.createdBy,
      assignedTo: params.assignedTo || params.createdBy,
      priority: params.priority || "MEDIUM",
      dueDate: params.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      approvalPolicy: definition.approvalPolicies[0] || undefined,
      approvals: (definition.approvalPolicies[0]?.approverRolesOrUsers || []).map((roleName: string, idx: number) => ({
        stepId: `step-${idx + 1}`,
        stepName: `Aprovação ${roleName}`,
        approverRoleOrUser: roleName,
        status: "PENDING",
      })),
      history: [
        {
          id: `h-${Date.now()}`,
          action: "Criado",
          actor: params.createdBy,
          details: `Instância iniciada no estado '${initialState}'`,
          timestamp: now,
        },
      ],
      auditTrail: [],
      eventsLog: [],
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
    };

    // Audit Trail via WorkflowAuditService
    WorkflowAuditService.logAudit({
      instance,
      userId: params.createdBy,
      userName: params.createdBy.split("@")[0] || "Usuário",
      userRole: "Criador",
      action: "WORKFLOW_CREATED",
      fromState: "-",
      toState: initialState,
      comment: `Workflow criado para a entidade ${params.entityType} #${params.entityId}`,
    });

    // Domain event via NotificationService (v1)
    NotificationService.publishEvent({
      instance,
      eventType: "WorkflowCreated",
      payload: {
        title: params.title,
        priority: params.priority || "MEDIUM",
        createdBy: params.createdBy,
      },
      metadata: {
        workflowKey: definition.workflowKey,
        version: definition.version,
        ...params.metadata,
      },
    });

    this.instances.set(workflowId, instance);
    return instance;
  }

  /**
   * Execute state transition on a workflow instance guarded by WorkflowLockService
   */
  public static async transitionState(params: TransitionParams): Promise<WorkflowInstance> {
    return WorkflowLockService.executeWithLock(params.workflowId, params.actorName, async () => {
      const instance = this.instances.get(params.workflowId);
      if (!instance) {
        throw new Error(`WorkflowInstance não encontrada com ID: ${params.workflowId}`);
      }

      // Optimistic concurrency check
      WorkflowLockService.validateOptimisticLock(instance, params.expectedUpdatedAt);

      const definition = WorkflowDefinitionService.getDefinitionByIdSync(instance.definitionId);
      if (!definition) {
        throw new Error(`WorkflowDefinition de origem não encontrada: ${instance.definitionId}`);
      }

      // Validate state machine rule
      const validation = WorkflowStateMachineService.validateTransition(
        definition,
        instance.currentState,
        params.targetState,
        params.actorRole
      );

      if (!validation.allowed) {
        throw new Error(validation.reason || "Transição de estado negada pela máquina de estados.");
      }

      const now = new Date().toISOString();
      const fromState = instance.currentState;
      instance.currentState = params.targetState;
      instance.nextAvailableStates = WorkflowStateMachineService.getNextAvailableStates(
        definition,
        params.targetState,
        params.actorRole
      );

      // Audit Trail
      WorkflowAuditService.logAudit({
        instance,
        userId: params.actorId,
        userName: params.actorName,
        userRole: params.actorRole,
        action: "STATE_TRANSITION",
        fromState,
        toState: params.targetState,
        comment: params.comment || `Transição de '${fromState}' para '${params.targetState}'`,
      });

      // History
      instance.history.push({
        id: `h-${Date.now()}`,
        action: "Transição de Estado",
        actor: params.actorName,
        details: `Transição: ${fromState} → ${params.targetState}`,
        timestamp: now,
      });

      // Determine domain event type (v1)
      let eventType: WorkflowDomainEventV1["eventType"] = "WorkflowApproved";
      if (params.targetState === "Rejected") eventType = "WorkflowRejected";
      else if (params.targetState === "Returned") eventType = "WorkflowReturned";
      else if (params.targetState === "Completed") eventType = "WorkflowCompleted";

      NotificationService.publishEvent({
        instance,
        eventType,
        payload: {
          fromState,
          toState: params.targetState,
          comment: params.comment,
        },
        metadata: {
          actorId: params.actorId,
          actorRole: params.actorRole,
        },
      });

      instance.updatedAt = now;
      this.instances.set(instance.workflowId, instance);

      return instance;
    });
  }

  /**
   * Process approval action guarded by WorkflowLockService & ApprovalService
   */
  public static async processApprovalAction(params: ProcessApprovalExecutionParams): Promise<WorkflowInstance> {
    return WorkflowLockService.executeWithLock(params.workflowId, params.approverName, async () => {
      const instance = this.instances.get(params.workflowId);
      if (!instance) {
        throw new Error(`WorkflowInstance não encontrada com ID: ${params.workflowId}`);
      }

      // Optimistic concurrency check
      WorkflowLockService.validateOptimisticLock(instance, params.expectedUpdatedAt);

      const approvalResult = ApprovalService.processApproval({
        instance,
        stepId: params.stepId,
        approverUserOrRole: params.approverUserOrRole,
        approverName: params.approverName,
        action: params.action,
        comment: params.comment,
      });

      const now = new Date().toISOString();

      // If approval policy resolved a state transition
      if (approvalResult.nextTargetState) {
        const fromState = instance.currentState;
        instance.currentState = approvalResult.nextTargetState;

        const definition = WorkflowDefinitionService.getDefinitionByIdSync(instance.definitionId);
        if (definition) {
          instance.nextAvailableStates = WorkflowStateMachineService.getNextAvailableStates(
            definition,
            instance.currentState,
            params.approverRole
          );
        }

        WorkflowAuditService.logAudit({
          instance,
          userId: params.approverUserOrRole,
          userName: params.approverName,
          userRole: params.approverRole,
          action: `APPROVAL_POLICY_${approvalResult.overallStatus}`,
          fromState,
          toState: instance.currentState,
          comment: params.comment || `Aprovação processada com resultado ${approvalResult.overallStatus}`,
        });

        let eventType: WorkflowDomainEventV1["eventType"] = "WorkflowApproved";
        if (approvalResult.overallStatus === "REJECTED") eventType = "WorkflowRejected";
        else if (approvalResult.overallStatus === "RETURNED") eventType = "WorkflowReturned";

        NotificationService.publishEvent({
          instance,
          eventType,
          payload: {
            fromState,
            toState: instance.currentState,
            overallStatus: approvalResult.overallStatus,
          },
        });
      }

      instance.updatedAt = now;
      this.instances.set(instance.workflowId, instance);

      return instance;
    });
  }

  /**
   * Get workflow instance by ID
   */
  public static getInstanceById(workflowId: string): WorkflowInstance | undefined {
    return this.instances.get(workflowId);
  }

  /**
   * List workflow instances with optional filtering
   */
  public static listInstances(filters?: WorkflowFilterOptions): WorkflowInstance[] {
    let result = Array.from(this.instances.values());

    if (!filters) return result;

    if (filters.workflowKey) {
      result = result.filter(i => i.workflowKey === filters.workflowKey);
    }
    if (filters.entityType) {
      result = result.filter(i => i.entityType === filters.entityType);
    }
    if (filters.entityId) {
      result = result.filter(i => i.entityId === filters.entityId);
    }
    if (filters.currentState) {
      result = result.filter(i => i.currentState === filters.currentState);
    }
    if (filters.assignedTo) {
      result = result.filter(i => i.assignedTo === filters.assignedTo);
    }
    if (filters.priority) {
      result = result.filter(i => i.priority === filters.priority);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        i =>
          i.title.toLowerCase().includes(q) ||
          i.workflowId.toLowerCase().includes(q) ||
          i.entityId.toLowerCase().includes(q) ||
          i.entityType.toLowerCase().includes(q)
      );
    }

    return result;
  }
}
