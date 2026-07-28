// ==============================================================================
// NOTIFICATION SERVICE (DOMAIN EVENTS BUS v1)
// Sprint 4.1 — Enterprise Workflow Engine (Phase 3 Workflow Instances)
// ==============================================================================

import { DomainEventType, WorkflowDomainEventV1, WorkflowInstance } from "./types";

export interface PublishEventParams {
  instance: WorkflowInstance;
  eventType: DomainEventType;
  payload?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private static subscribers: Array<(event: WorkflowDomainEventV1) => void> = [];

  /**
   * Subscribe to public workflow domain events
   */
  public static subscribe(callback: (event: WorkflowDomainEventV1) => void): void {
    this.subscribers.push(callback);
  }

  /**
   * Publish a versioned WorkflowDomainEventV1 event
   */
  public static publishEvent(params: PublishEventParams): WorkflowDomainEventV1 {
    const now = new Date().toISOString();
    const event: WorkflowDomainEventV1 = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventVersion: "v1",
      eventType: params.eventType,
      occurredAt: now,
      workflowId: params.instance.workflowId,
      workflowDefinitionId: params.instance.definitionId,
      entityType: params.instance.entityType,
      entityId: params.instance.entityId,
      payload: {
        title: params.instance.title,
        currentState: params.instance.currentState,
        priority: params.instance.priority,
        ...params.payload,
      },
      metadata: {
        workflowKey: params.instance.workflowKey,
        assignedTo: params.instance.assignedTo,
        createdBy: params.instance.createdBy,
        ...params.metadata,
      },
    };

    // Store event on instance log
    params.instance.eventsLog.push(event);

    // Notify registered subscribers
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error("[NotificationService] Erro ao notificar subscritor de evento de domínio:", err);
      }
    }

    return event;
  }
}
