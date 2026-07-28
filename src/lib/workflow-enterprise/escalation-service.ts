// ==============================================================================
// ESCALATION SERVICE
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { NotificationService } from "./notification-service";
import { WorkflowInstance } from "./types";

export interface EscalationCheckResult {
  workflowId: string;
  isOverdue: boolean;
  hoursOverdue: number;
  escalated: boolean;
}

export class EscalationService {
  /**
   * Evaluate SLA due date for a workflow instance and trigger escalation if overdue
   */
  public static evaluateEscalation(instance: WorkflowInstance): EscalationCheckResult {
    const now = Date.now();
    const due = new Date(instance.dueDate).getTime();

    if (isNaN(due)) {
      return { workflowId: instance.workflowId, isOverdue: false, hoursOverdue: 0, escalated: false };
    }

    const isOverdue = now > due;
    const hoursOverdue = isOverdue ? Math.round((now - due) / (1000 * 60 * 60)) : 0;

    let escalated = false;
    if (isOverdue && instance.currentState !== "Completed" && instance.currentState !== "Cancelled") {
      escalated = true;
      NotificationService.publishEvent({
        instance,
        eventType: "WorkflowExpired",
        payload: {
          dueDate: instance.dueDate,
          hoursOverdue,
          escalationTriggered: true,
        },
      });
    }

    return {
      workflowId: instance.workflowId,
      isOverdue,
      hoursOverdue,
      escalated,
    };
  }
}
