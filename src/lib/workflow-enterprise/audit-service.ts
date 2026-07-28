// ==============================================================================
// WORKFLOW AUDIT SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { AuditTrailEntry, WorkflowInstance } from "./types";

export interface LogAuditParams {
  instance: WorkflowInstance;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  fromState: string;
  toState: string;
  comment?: string;
}

export class WorkflowAuditService {
  /**
   * Append an immutable audit record to a workflow instance
   */
  public static logAudit(params: LogAuditParams): AuditTrailEntry {
    const now = new Date().toISOString();
    const entry: AuditTrailEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      fromState: params.fromState,
      toState: params.toState,
      comment: params.comment,
      timestamp: now,
    };

    params.instance.auditTrail.push(entry);
    return entry;
  }
}
