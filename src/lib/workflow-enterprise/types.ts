// ==============================================================================
// ENTERPRISE WORKFLOW ENGINE — DATA CONTRACTS & DOMAIN TYPES (v1)
// Sprint 4.1 — Domain-Neutral Corporate Workflow Infrastructure
// ==============================================================================

export type WorkflowPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ApprovalMode = 'SINGLE' | 'SEQUENTIAL' | 'PARALLEL' | 'QUORUM';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';

export type DomainEventType = 
  | 'WorkflowCreated' 
  | 'WorkflowApproved' 
  | 'WorkflowRejected' 
  | 'WorkflowReturned' 
  | 'WorkflowCompleted' 
  | 'WorkflowExpired';

/**
 * Versioned Public Domain Event Contract (v1)
 */
export interface WorkflowDomainEventV1 {
  eventId: string;
  eventVersion: 'v1';
  eventType: DomainEventType;
  occurredAt: string; // ISO 8601 UTC
  workflowId: string;
  workflowDefinitionId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, any>;
  metadata: Record<string, any>;
}

export interface StateTransitionRule {
  fromState: string;
  toState: string;
  allowedRoles?: string[];
  requiresApproval?: boolean;
  approvalPolicyKey?: string;
  description?: string;
}

export interface StateMachineConfig {
  initialState: string;
  terminalStates: string[];
  transitions: StateTransitionRule[];
}

export interface ApprovalPolicyConfig {
  policyKey: string;
  mode: ApprovalMode;
  quorumPercentage?: number; // e.g. 50, 75, 100 for QUORUM mode
  approverRolesOrUsers: string[];
  allowSelfApproval?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  workflowKey: string;
  name: string;
  description: string;
  entityType: string; // e.g. "CRM_OPPORTUNITY", "SOP_PLAN", "HR_REQUEST", "TRADE_MISSION"
  version: number;
  stateMachine: StateMachineConfig;
  approvalPolicies: ApprovalPolicyConfig[];
  metadata?: Record<string, any>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  stepId: string;
  stepName: string;
  approverRoleOrUser: string;
  status: ApprovalStatus;
  comment?: string;
  actionBy?: string;
  updatedAt?: string;
}

export interface AuditTrailEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  fromState: string;
  toState: string;
  comment?: string;
  timestamp: string;
}

export interface WorkflowHistoryItem {
  id: string;
  action: string;
  actor: string;
  details: string;
  timestamp: string;
}

export interface WorkflowInstance {
  workflowId: string;
  definitionId: string;
  workflowKey: string;
  entityType: string;
  entityId: string;
  title: string;
  currentState: string;
  nextAvailableStates: string[];
  createdBy: string;
  assignedTo: string;
  priority: WorkflowPriority;
  dueDate: string;
  approvalPolicy?: ApprovalPolicyConfig;
  approvals: ApprovalStep[];
  history: WorkflowHistoryItem[];
  auditTrail: AuditTrailEntry[];
  eventsLog: WorkflowDomainEventV1[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowFilterOptions {
  workflowKey?: string;
  entityType?: string;
  entityId?: string;
  currentState?: string;
  assignedTo?: string;
  createdBy?: string;
  priority?: WorkflowPriority;
  activeOnly?: boolean;
  search?: string;
}

export interface WorkflowAnalyticsSummary {
  totalDefinitions: number;
  activeDefinitions: number;
  totalInstances: number;
  instancesByState: Record<string, number>;
  instancesByEntityType: Record<string, number>;
  averageCycleTimeHours: number;
  slaCompliancePct: number;
  pendingApprovalsCount: number;
}
